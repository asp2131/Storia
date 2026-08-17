import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Storage helpers for parent-recorded narration.
 *
 * Objects live under `user-narrations/{userId}/{bookId}/{trackId}/…` so a
 * per-account purge is a single prefix delete. `scripts/storage-gc.mjs` must
 * treat `user_narration_page.audio_path` as a reference — see the referenced
 * columns list there.
 */

export const NARRATION_BUCKET =
  process.env.SUPABASE_STORAGE_BUCKET ||
  process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET ||
  "storia-storage";

/** Upload limits — a page of a picture book, not an audiobook. */
export const MAX_RECORDING_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_RECORDING_SECONDS = 5 * 60;

const EXTENSION_BY_CONTENT_TYPE: Record<string, string> = {
  "audio/mp4": "m4a",
  "audio/m4a": "m4a",
  "audio/x-m4a": "m4a",
  "audio/aac": "aac",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
};

export function isSupportedAudioType(contentType: string): boolean {
  return Boolean(EXTENSION_BY_CONTENT_TYPE[contentType.split(";")[0].trim().toLowerCase()]);
}

export function extensionForContentType(contentType: string): string {
  return EXTENSION_BY_CONTENT_TYPE[contentType.split(";")[0].trim().toLowerCase()] || "m4a";
}

let cachedClient: SupabaseClient | null = null;

export function getNarrationStorageClient(): SupabaseClient {
  if (cachedClient) return cachedClient;

  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  if (!url || !serviceRoleKey) {
    throw new Error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY for narration storage.");
  }

  cachedClient = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cachedClient;
}

export function buildRecordingPath(args: {
  userId: string;
  bookId: string;
  trackId: string;
  pageNumber: number;
  contentType: string;
}): string {
  const ext = extensionForContentType(args.contentType);
  const stamp = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  return `user-narrations/${args.userId}/${args.bookId}/${args.trackId}/page_${args.pageNumber}_${stamp}.${ext}`;
}

export async function uploadRecording(args: {
  path: string;
  audio: Buffer;
  contentType: string;
}): Promise<string> {
  const supabase = getNarrationStorageClient();

  const { error } = await supabase.storage
    .from(NARRATION_BUCKET)
    .upload(args.path, args.audio, { contentType: args.contentType, upsert: false });

  if (error) {
    throw new Error(`Failed to upload recording: ${error.message}`);
  }

  const { data } = supabase.storage.from(NARRATION_BUCKET).getPublicUrl(args.path);
  return data.publicUrl;
}

/**
 * Remove objects via the Storage API. Deleting rows from `storage.objects` in
 * SQL does NOT free the underlying file — always go through this.
 */
export async function removeRecordings(paths: string[]): Promise<void> {
  const cleaned = paths.filter((p) => p && p.length > 0);
  if (cleaned.length === 0) return;

  const supabase = getNarrationStorageClient();
  const { error } = await supabase.storage.from(NARRATION_BUCKET).remove(cleaned);

  if (error) {
    // Orphaned audio is recoverable via storage GC; failing the request here
    // would strand the caller with rows already deleted.
    console.warn(`[narration] failed to remove ${cleaned.length} object(s): ${error.message}`);
  }
}
