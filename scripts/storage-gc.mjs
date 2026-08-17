#!/usr/bin/env node
// Storage GC for the storia-storage bucket.
// Lists every object, builds the set of paths still referenced by the DB, and
// reports (or deletes) the difference.
//
// Usage:
//   node scripts/storage-gc.mjs                      # dry run, all tiers
//   node scripts/storage-gc.mjs --list A,B           # dry run + print every path
//   node scripts/storage-gc.mjs --delete --tier A,B  # actually delete
//
// Tiers:
//   A  books/temp/**            scratch uploads
//   B  books/<id>/**            book row no longer exists
//   C  books/<id>/**            book row exists, asset superseded (regenerations)
//   D  cover-images/**          unreferenced covers
//
// audio/** is never a candidate: audio/curated is the soundscape library, which
// is enumerated by listing storage, not by DB reference (src/app/api/soundscapes/route.ts).
// pdfs/** is never a candidate: source PDFs, books.pdf_url is currently all NULL.

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const BUCKET = 'storia-storage'
const NEVER_DELETE = [/^audio\//, /^pdfs\//]

for (const file of ['.env', '.env.local']) {
  try {
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  } catch {}
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL / service role key')
const db = createClient(url, key, { auth: { persistSession: false } })

const args = process.argv.slice(2)
const flag = (n) => args.includes(n)
const val = (n) => { const i = args.indexOf(n); return i === -1 ? null : args[i + 1] }
const DELETE = flag('--delete')
const TIERS = (val('--tier') || 'A,B,C,D').split(',').map((s) => s.trim().toUpperCase())
const LIST = (val('--list') || '').split(',').map((s) => s.trim().toUpperCase()).filter(Boolean)

// --- referenced paths -------------------------------------------------------

/** Turn any stored value into a bucket-relative object path. */
function toPath(v) {
  if (!v || typeof v !== 'string') return null
  const i = v.indexOf(`${BUCKET}/`)
  const raw = i === -1 ? v : v.slice(i + BUCKET.length + 1)
  if (raw.startsWith('http')) return null // points at some other host
  try {
    return decodeURIComponent(raw.split('?')[0])
  } catch {
    return raw.split('?')[0]
  }
}

/** Pull every page of a table; PostgREST caps a single response at 1000 rows. */
async function all(table, columns) {
  const out = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from(table).select(columns).range(from, from + 999)
    if (error) throw new Error(`${table}: ${error.message}`)
    out.push(...data)
    if (data.length < 1000) return out
  }
}

const referenced = new Set()
const add = (v) => { const p = toPath(v); if (p) referenced.add(p) }

const [pages, books, assignments, overlays, pronunciations, soundscapes, userNarrations] = await Promise.all([
  all('pages', 'image_url,composited_image_url,composited_image_path,narration_url,word_pronunciations'),
  all('books', 'id,cover_url,pdf_url'),
  all('page_audio_assignments', 'audio_url'),
  all('page_overlay_narrations', 'audio_url'),
  all('book_pronunciations', 'full_word_url,breakdown_url'),
  all('soundscapes', 'audio_url'),
  // Parent/teacher recorded narration. audio_path is the bucket path (audio_url
  // is the public URL); both are added so either form resolves.
  all('user_narration_page', 'audio_url,audio_path'),
])

for (const p of pages) {
  add(p.image_url); add(p.composited_image_url); add(p.composited_image_path); add(p.narration_url)
  // word_pronunciations is jsonb and embeds audio URLs of its own
  if (p.word_pronunciations) {
    const text = JSON.stringify(p.word_pronunciations)
    for (const m of text.matchAll(new RegExp(`${BUCKET}/[^"\\\\ ]+`, 'g'))) add(m[0])
  }
}
for (const b of books) { add(b.cover_url); add(b.pdf_url) }
for (const a of assignments) add(a.audio_url)
for (const o of overlays) add(o.audio_url)
for (const p of pronunciations) { add(p.full_word_url); add(p.breakdown_url) }
for (const s of soundscapes) add(s.audio_url)
for (const n of userNarrations) { add(n.audio_url); add(n.audio_path) }

const liveBookIds = new Set(books.map((b) => String(b.id)))

// --- every object in the bucket ---------------------------------------------

async function walk(prefix = '') {
  const found = []
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await db.storage.from(BUCKET).list(prefix, { limit: 1000, offset })
    if (error) throw new Error(`list ${prefix}: ${error.message}`)
    for (const entry of data) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name
      // Storage folders are synthetic: they come back with a null id.
      if (entry.id === null) found.push(...(await walk(path)))
      else found.push({ path, size: entry.metadata?.size ?? 0 })
    }
    if (data.length < 1000) return found
  }
}

const objects = await walk()

// --- classify ---------------------------------------------------------------

function tierOf(path) {
  if (path.startsWith('books/temp/')) return 'A'
  if (path.startsWith('cover-images/')) return 'D'
  const id = path.split('/')[1]
  if (path.startsWith('books/') && /^\d+$/.test(id)) return liveBookIds.has(id) ? 'C' : 'B'
  return 'C'
}

const orphans = objects.filter(
  (o) => !referenced.has(o.path) && !NEVER_DELETE.some((re) => re.test(o.path)),
)

const mb = (n) => `${(n / 1024 / 1024).toFixed(1)} MB`
const byTier = {}
for (const o of orphans) (byTier[tierOf(o.path)] ??= []).push(o)

console.log(`bucket objects: ${objects.length}   referenced: ${referenced.size}   orphans: ${orphans.length}\n`)
for (const t of ['A', 'B', 'C', 'D']) {
  const group = byTier[t] ?? []
  const size = group.reduce((s, o) => s + Number(o.size), 0)
  console.log(`tier ${t}: ${String(group.length).padStart(5)} objects  ${mb(size).padStart(9)}${TIERS.includes(t) ? '' : '   (excluded)'}`)
  if (LIST.includes(t)) for (const o of group) console.log(`         ${o.path}`)
}

const targets = TIERS.flatMap((t) => byTier[t] ?? [])
const targetSize = targets.reduce((s, o) => s + Number(o.size), 0)
console.log(`\nselected tiers ${TIERS.join(',')}: ${targets.length} objects, ${mb(targetSize)}`)

if (!DELETE) {
  console.log('dry run — re-run with --delete to remove them')
  process.exit(0)
}

for (let i = 0; i < targets.length; i += 100) {
  const batch = targets.slice(i, i + 100).map((o) => o.path)
  const { error } = await db.storage.from(BUCKET).remove(batch)
  if (error) throw new Error(`remove batch at ${i}: ${error.message}`)
  console.log(`deleted ${Math.min(i + 100, targets.length)}/${targets.length}`)
}
console.log(`done — removed ${targets.length} objects, ${mb(targetSize)}`)
