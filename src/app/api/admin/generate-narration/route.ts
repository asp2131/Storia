import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Replicate from "replicate";

const supabaseUrl =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY ||
  "";

function buildSupabaseClient() {
  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
}

function buildReplicateClient() {
  const apiToken = process.env.REPLICATE_API_TOKEN || process.env.REPLICATE_KEY;
  if (!apiToken) {
    return null;
  }
  return new Replicate({ auth: apiToken });
}

export async function POST(request: NextRequest) {
  const supabase = buildSupabaseClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Missing Supabase configuration." },
      { status: 500 }
    );
  }

  const replicate = buildReplicateClient();
  if (!replicate) {
    return NextResponse.json(
      { error: "Missing Replicate API token. Please set REPLICATE_API_TOKEN in your environment." },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const { text, bookId, pageNumber, voice } = body;

    if (!text || typeof text !== "string") {
      return NextResponse.json(
        { error: "Text content is required." },
        { status: 400 }
      );
    }

    if (!bookId) {
      return NextResponse.json(
        { error: "Book ID is required." },
        { status: 400 }
      );
    }

    if (!pageNumber) {
      return NextResponse.json(
        { error: "Page number is required." },
        { status: 400 }
      );
    }

    // Trim and validate text length
    const trimmedText = text.trim();
    if (trimmedText.length === 0) {
      return NextResponse.json(
        { error: "Text content cannot be empty." },
        { status: 400 }
      );
    }

    if (trimmedText.length > 5000) {
      return NextResponse.json(
        { error: "Text content is too long. Maximum 5000 characters." },
        { status: 400 }
      );
    }

    console.log(`[generate-narration] Generating for book ${bookId}, page ${pageNumber}`);

    // Call Kokoro TTS model on Replicate
    // Using kokoro - a high-quality open-source TTS model
    // Voice options: af_bella (warm female), af_sarah, bf_emma (British), am_adam (male), etc.
    const output = await replicate.run(
      "jaaari/kokoro-82m:f559560eb822dc509045f3921a1921234918b91739db4bf3daab2169b71c7a13",
      {
        input: {
          text: trimmedText,
          voice: voice || "af_nicole", // Default voice - warm female narrator
          speed: 1.0,
        },
      }
    );

    // The output should be a URL to the generated audio
    if (!output) {
      return NextResponse.json(
        { error: "Failed to generate audio - no output from model." },
        { status: 500 }
      );
    }

    // Kokoro returns a FileOutput object with a url() method or href property
    let audioUrl: string;
    if (typeof output === "string") {
      audioUrl = output;
    } else if (output instanceof URL) {
      audioUrl = output.href;
    } else if (typeof output === "object" && output !== null) {
      // Handle FileOutput object - it has href property
      const fileOutput = output as { href?: string; url?: () => URL };
      if (fileOutput.href) {
        audioUrl = fileOutput.href;
      } else if (typeof fileOutput.url === "function") {
        audioUrl = fileOutput.url().href;
      } else {
        audioUrl = String(output);
      }
    } else {
      audioUrl = String(output);
    }

    console.log(`[generate-narration] Got audio URL from Replicate: ${audioUrl}`);

    // Download the audio file from Replicate
    const audioResponse = await fetch(audioUrl);
    if (!audioResponse.ok) {
      return NextResponse.json(
        { error: "Failed to download generated audio." },
        { status: 500 }
      );
    }

    const audioBuffer = Buffer.from(await audioResponse.arrayBuffer());
    const contentType = audioResponse.headers.get("content-type") || "audio/wav";

    // Determine file extension
    let ext = "wav";
    if (contentType.includes("mp3") || contentType.includes("mpeg")) {
      ext = "mp3";
    } else if (contentType.includes("ogg")) {
      ext = "ogg";
    }

    // Upload to Supabase storage
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const filePath = `books/${bookId}/narration/page_${pageNumber}_${timestamp}_${random}.${ext}`;

    const bucket =
      process.env.SUPABASE_STORAGE_BUCKET ||
      process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET ||
      "storia-storage";

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(filePath, audioBuffer, {
        contentType,
        upsert: false,
      });

    if (uploadError) {
      console.error("[generate-narration] Upload error:", uploadError);
      return NextResponse.json(
        { error: uploadError.message || "Failed to upload audio." },
        { status: 500 }
      );
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(filePath);

    console.log(`[generate-narration] Uploaded to: ${urlData.publicUrl}`);

    return NextResponse.json({
      url: urlData.publicUrl,
      path: filePath,
      duration: null, // Could extract from audio metadata if needed
    });
  } catch (error) {
    console.error("[generate-narration] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate narration." },
      { status: 500 }
    );
  }
}
