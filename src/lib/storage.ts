import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-side Supabase client with service role key.
 *
 * IMPORTANT: Uses SUPABASE_SERVICE_ROLE_KEY (no NEXT_PUBLIC_ prefix).
 * This key grants full storage access and must NEVER be exposed to
 * the browser. Only import this module in server-side code (API routes,
 * server components, lib modules).
 */
let storageClient: SupabaseClient | null = null;

function getStorageClient(): SupabaseClient {
  if (storageClient) return storageClient;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables. " +
        "These must be set as server-only env vars (no NEXT_PUBLIC_ prefix)."
    );
  }

  storageClient = createClient(url, key, {
    auth: { persistSession: false },
  });

  return storageClient;
}

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "storia-storage";

/**
 * Upload a composited image to Supabase storage.
 * Returns the public URL and storage path.
 */
export async function uploadCompositedImage(
  bookId: string | bigint,
  pageNumber: number,
  buffer: Buffer,
  contentType: string
): Promise<{ url: string; path: string }> {
  const client = getStorageClient();
  const timestamp = Date.now();
  const path = `books/${bookId}/composited/${pageNumber}_${timestamp}.png`;

  const { error } = await client.storage.from(BUCKET).upload(path, buffer, {
    contentType,
    upsert: true,
  });

  if (error) {
    throw new Error(`Storage upload failed: ${error.message}`);
  }

  const { data } = client.storage.from(BUCKET).getPublicUrl(path);

  return { url: data.publicUrl, path };
}

/**
 * Delete a previously composited image from storage.
 * Silently ignores errors (image may already be deleted).
 */
export async function deleteCompositedImage(path: string): Promise<void> {
  try {
    const client = getStorageClient();
    await client.storage.from(BUCKET).remove([path]);
  } catch (error) {
    console.warn("[storage] Failed to delete composited image:", error);
  }
}
