#!/usr/bin/env node
// Newsletter sync: copy verified Loratone users into the Resend "Newsletter" segment.
//
// The newsletter itself is a Resend Broadcast written and sent from the Resend
// dashboard to that segment. Resend handles the unsubscribe link
// ({{{RESEND_UNSUBSCRIBE_URL}}}), one-click List-Unsubscribe headers, throttling
// and test sends, so none of that lives here.
//
// Usage (the env file picks the database: .env is prod, .env.local is docker):
//   node scripts/newsletter-sync.mjs .env          # dry run, read-only
//   node scripts/newsletter-sync.mjs .env --apply  # add new users to Resend
//
// The env file overrides the shell, so an exported DATABASE_URL can't silently win.
// Needs NEWSLETTER_RESEND_API_KEY (full access): the app's RESEND_API_KEY is send-only
// and can't read or write contacts.
//
// Never sends `unsubscribed`, so anyone who unsubscribed stays unsubscribed.

import { readFileSync } from 'node:fs'
import { parseEnv } from 'node:util'
import pg from 'pg'
import { Resend } from 'resend'

const envFile = process.argv[2]
if (!envFile || envFile.startsWith('-')) throw new Error('usage: node scripts/newsletter-sync.mjs <env file> [--apply]')
Object.assign(process.env, parseEnv(readFileSync(envFile, 'utf8')))

const SEGMENT_NAME = process.env.NEWSLETTER_SEGMENT || 'Newsletter'
const apply = process.argv.includes('--apply')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

if (!process.env.DATABASE_URL) throw new Error(`DATABASE_URL missing in ${envFile}`)
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
// Parents only: child_profile rows hang off these accounts, kids have no row in "user".
const { rows: users } = await pool.query(
  `select lower(email) as email, name from "user" where "emailVerified" = true order by "createdAt"`
)
await pool.end()
console.log(`${users.length} verified users in ${new URL(process.env.DATABASE_URL).host}`)

const key = process.env.NEWSLETTER_RESEND_API_KEY || ''
if (!key.startsWith('re_')) {
  if (apply) throw new Error('NEWSLETTER_RESEND_API_KEY missing (full-access Resend key)')
  console.log('no NEWSLETTER_RESEND_API_KEY: skipped the Resend check')
  process.exit(0)
}
const resend = new Resend(key)
const unwrap = ({ data, error }, what) => {
  if (error) throw new Error(`${what}: ${error.message}`)
  return data
}

let segment = unwrap(await resend.segments.list(), 'list segments').data.find((s) => s.name === SEGMENT_NAME)
if (!segment && apply) segment = unwrap(await resend.segments.create({ name: SEGMENT_NAME }), 'create segment')

const already = new Set()
if (segment) {
  // No limit = every contact in the segment in one response.
  for (const c of unwrap(await resend.contacts.list({ segmentId: segment.id }), 'list contacts').data) {
    already.add(c.email.toLowerCase())
  }
}
const todo = users.filter((u) => !already.has(u.email))
console.log(`${already.size} already in "${SEGMENT_NAME}", ${todo.length} to add`)
if (!apply) process.exit(0)

let failed = 0
for (const u of todo) {
  // Mobile signups with no name get the email's local part as name; don't greet "Hi jdoe123".
  const firstName = u.name && u.name !== u.email.split('@')[0] ? u.name.split(' ')[0] : undefined
  // ponytail: sequential at ~6 req/s stays under Resend's 10/s team limit (shared with OTP mail); CSV import past a few thousand users
  const created = await resend.contacts.create({ email: u.email, firstName })
  await sleep(150)
  // create errors if the contact already exists (e.g. added by hand); adding it to the segment still works
  const added = await resend.contacts.segments.add({ email: u.email, segmentId: segment.id })
  await sleep(150)
  if (added.error) {
    failed++
    console.error(`  ${u.email}: ${added.error.message}${created.error ? ` (create: ${created.error.message})` : ''}`)
  }
}
console.log(`added ${todo.length - failed}, failed ${failed}`)
process.exitCode = failed ? 1 : 0
