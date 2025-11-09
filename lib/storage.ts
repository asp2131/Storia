import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { withRetry, isRetryableError } from "./retry";
import { StorageError } from "./errors";

// Initialize S3 client for Cloudflare R2
const s3Client = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY!,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_KEY!,
  },
  forcePathStyle: true, // Required for R2
});

const BUCKET_NAME = process.env.CLOUDFLARE_R2_BUCKET!;
const PUBLIC_DOMAIN = process.env.CLOUDFLARE_R2_PUBLIC_DOMAIN!;

/**
 * Upload a PDF file to R2 storage
 * @param pdfBuffer - The PDF file as a Buffer
 * @param bookId - Unique book identifier
 * @returns Public URL of the uploaded PDF
 */
export async function uploadPDFToR2(
  pdfBuffer: Buffer,
  bookId: string
): Promise<string> {
  const key = `books/${bookId}.pdf`;

  try {
    await withRetry(
      async () => {
        await s3Client.send(
          new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key,
            Body: pdfBuffer,
            ContentType: "application/pdf",
          })
        );
      },
      3,
      1000
    );

    const publicUrl = `https://${PUBLIC_DOMAIN}/${key}`;
    console.log(`✅ PDF uploaded successfully: ${publicUrl}`);
    return publicUrl;
  } catch (error) {
    console.error("❌ Error uploading PDF to R2:", error);
    throw new StorageError(
      "upload PDF",
      error instanceof Error ? error : new Error("Unknown error")
    );
  }
}

/**
 * Upload an audio file to R2 storage
 * @param sourceUrl - URL of the audio file to download and upload
 * @param sceneId - Unique scene identifier
 * @returns Public URL of the uploaded audio file
 */
export async function uploadToR2(
  sourceUrl: string,
  sceneId: string
): Promise<string> {
  const key = `soundscapes/${sceneId}.wav`;

  try {
    // Download the audio file from the source URL
    console.log(`📥 Downloading audio from: ${sourceUrl}`);
    const response = await fetch(sourceUrl);

    if (!response.ok) {
      throw new Error(`Failed to download audio: ${response.statusText}`);
    }

    const audioBuffer = await response.arrayBuffer();

    // Upload to R2
    await s3Client.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: Buffer.from(audioBuffer),
        ContentType: "audio/wav",
      })
    );

    const publicUrl = `https://${PUBLIC_DOMAIN}/${key}`;
    console.log(`✅ Audio uploaded successfully: ${publicUrl}`);
    return publicUrl;
  } catch (error) {
    console.error("❌ Error uploading audio to R2:", error);
    throw new Error(
      `Failed to upload audio: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Upload a buffer directly to R2 storage
 * @param buffer - The file buffer
 * @param key - Storage key/path
 * @param contentType - MIME type of the file
 * @returns Public URL of the uploaded file
 */
export async function uploadBufferToR2(
  buffer: Buffer,
  key: string,
  contentType: string
): Promise<string> {
  try {
    await s3Client.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      })
    );

    const publicUrl = `https://${PUBLIC_DOMAIN}/${key}`;
    console.log(`✅ File uploaded successfully: ${publicUrl}`);
    return publicUrl;
  } catch (error) {
    console.error("❌ Error uploading file to R2:", error);
    throw new Error(
      `Failed to upload file: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Delete a file from R2 storage
 * @param key - Storage key/path of the file to delete
 */
export async function deleteFromR2(key: string): Promise<void> {
  try {
    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
      })
    );

    console.log(`✅ File deleted successfully: ${key}`);
  } catch (error) {
    console.error("❌ Error deleting file from R2:", error);
    throw new Error(
      `Failed to delete file: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Get a file from R2 storage
 * @param key - Storage key/path of the file
 * @returns File buffer
 */
export async function getFromR2(key: string): Promise<Buffer> {
  try {
    const response = await s3Client.send(
      new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
      })
    );

    if (!response.Body) {
      throw new Error("No file body returned");
    }

    // Convert stream to buffer
    const chunks: Uint8Array[] = [];
    for await (const chunk of response.Body as any) {
      chunks.push(chunk);
    }

    return Buffer.concat(chunks);
  } catch (error) {
    console.error("❌ Error getting file from R2:", error);
    throw new Error(
      `Failed to get file: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Check if R2 storage is properly configured
 * @returns true if configured, false otherwise
 */
export function isR2Configured(): boolean {
  return !!(
    process.env.CLOUDFLARE_ACCOUNT_ID &&
    process.env.CLOUDFLARE_R2_ACCESS_KEY &&
    process.env.CLOUDFLARE_R2_SECRET_KEY &&
    process.env.CLOUDFLARE_R2_BUCKET &&
    process.env.CLOUDFLARE_R2_PUBLIC_DOMAIN
  );
}

/**
 * Get the public URL for a stored file
 * @param key - Storage key/path
 * @returns Public URL
 */
export function getPublicUrl(key: string): string {
  return `https://${PUBLIC_DOMAIN}/${key}`;
}
