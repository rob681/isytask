import { createClient } from "@supabase/supabase-js";

// Lazy-init: only create client when actually needed (avoids errors if env vars missing at build time)
let _supabase: ReturnType<typeof createClient> | null = null;

function getClient() {
  if (!_supabase) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error(
        "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables"
      );
    }
    _supabase = createClient(url, key);
  }
  return _supabase;
}

/**
 * Upload a file to Supabase Storage and return its public URL.
 *
 * @param bucket  - "images" or "attachments"
 * @param path    - e.g. "avatars/user-123-1234567890.jpg"
 * @param buffer  - File contents as Buffer
 * @param contentType - MIME type
 */
export async function uploadFile(
  bucket: string,
  path: string,
  buffer: Buffer,
  contentType: string
): Promise<{ storagePath: string; url: string }> {
  const supabase = getClient();

  const { error } = await supabase.storage.from(bucket).upload(path, buffer, {
    contentType,
    upsert: true,
  });

  if (error) {
    console.error("[Supabase Storage] Upload error:", error);
    throw new Error(`Failed to upload file: ${error.message}`);
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(bucket).getPublicUrl(path);

  return { storagePath: `${bucket}/${path}`, url: publicUrl };
}

/**
 * Delete a file from Supabase Storage.
 *
 * @param storagePath - Full path like "attachments/task-123/file.pdf"
 *                      (bucket/path format from uploadFile)
 */
export async function deleteFile(storagePath: string): Promise<void> {
  const supabase = getClient();

  // storagePath is "bucket/path" — split to get bucket and inner path
  const slashIdx = storagePath.indexOf("/");
  if (slashIdx === -1) return;

  const bucket = storagePath.substring(0, slashIdx);
  const path = storagePath.substring(slashIdx + 1);

  const { error } = await supabase.storage.from(bucket).remove([path]);

  if (error) {
    console.error("[Supabase Storage] Delete error:", error);
    // Don't throw — file might already be deleted
  }
}
