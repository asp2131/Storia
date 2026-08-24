import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { assertBookAccess, requireStudio } from "@/lib/admin-auth";

const supabaseUrl =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || "";

function buildClient() {
  if (!supabaseUrl || !serviceRoleKey) return null;
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
}

const ALLOWED_AUDIO_TYPES = [
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/wave",
  "audio/x-wav",
  "audio/ogg",
  "audio/flac",
  "audio/aac",
  "audio/mp4",
  "audio/x-m4a",
  "audio/webm",
];

const MAX_SIZE = 50 * 1024 * 1024; // 50 MB

export async function POST(request: NextRequest) {
  const authResult = await requireStudio();
  if (authResult instanceof NextResponse) return authResult;

  const supabase = buildClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Missing Supabase configuration." },
      { status: 500 }
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const bookId = formData.get("bookId") as string | null;

    const denied = await assertBookAccess(authResult.user, bookId);
    if (denied) return denied;

    if (!file) {
      return NextResponse.json({ error: "No file provided." }, { status: 400 });
    }

    if (!ALLOWED_AUDIO_TYPES.includes(file.type) && !file.name.match(/\.(mp3|wav|ogg|flac|aac|m4a|webm)$/i)) {
      return NextResponse.json(
        { error: "Invalid file type. Supported: MP3, WAV, OGG, FLAC, AAC, M4A, WebM." },
        { status: 400 }
      );
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 50MB." },
        { status: 400 }
      );
    }

    const ext = file.name.split(".").pop()?.toLowerCase() || "mp3";
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const safeName = file.name
      .replace(/\.[^.]+$/, "")
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .substring(0, 60);

    const filePath = bookId
      ? `books/${bookId}/audio/${safeName}_${timestamp}_${random}.${ext}`
      : `audio/uploads/${safeName}_${timestamp}_${random}.${ext}`;

    const bucket =
      process.env.SUPABASE_STORAGE_BUCKET ||
      process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET ||
      "storia-storage";

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(filePath, buffer, {
        contentType: file.type || "audio/mpeg",
        upsert: false,
      });

    if (uploadError) {
      console.error("[audio-uploads] Failed:", uploadError);
      return NextResponse.json(
        { error: uploadError.message || "Failed to upload audio." },
        { status: 500 }
      );
    }

    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(filePath);

    return NextResponse.json({
      url: urlData.publicUrl,
      path: filePath,
      name: file.name,
      size: file.size,
    });
  } catch (error) {
    console.error("[audio-uploads] Error:", error);
    return NextResponse.json(
      { error: "Failed to process audio upload." },
      { status: 500 }
    );
  }
}
