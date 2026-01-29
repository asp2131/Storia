import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import Replicate from "replicate";
import {
  alignWordsWithTimestamps,
  alignedWordsToTimestamps,
  validateTimestamps,
} from "@/lib/wordAlignment";

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

    // Step 2: Run Whisper for word-level timestamps
    console.log(`[generate-narration] Running Whisper for word timestamps...`);
    console.log(`[generate-narration] Audio URL for Whisper: ${urlData.publicUrl}`);

    const wordTimestamps: Array<{ word: string; start: number; end: number }> = [];

    try {
      // Use incredibly-fast-whisper which has proper word timestamp support
      const whisperOutput = await replicate.run(
        "vaibhavs10/incredibly-fast-whisper:3ab86df6c8f54c11309d4d1f930ac292bad43ace52d10c80d87eb258b3c9f79c",
        {
          input: {
            audio: urlData.publicUrl,
            task: "transcribe",
            language: "english",
            timestamp: "word",
            batch_size: 64,
          },
        }
      );

      console.log(`[generate-narration] Whisper raw output:`, JSON.stringify(whisperOutput, null, 2));

      // Parse Whisper output for word timestamps
      // incredibly-fast-whisper returns { text, chunks } where chunks have timestamp and text
      if (whisperOutput && typeof whisperOutput === "object") {
        const output = whisperOutput as {
          text?: string;
          chunks?: Array<{ timestamp: [number, number]; text: string }>;
          // Alternative structures
          segments?: Array<{
            words?: Array<{ word: string; start: number; end: number }>;
            start?: number;
            end?: number;
            text?: string;
          }>;
          words?: Array<{ word: string; start: number; end: number }>;
        };

        // Try chunks format (incredibly-fast-whisper with word timestamps)
        if (output.chunks && Array.isArray(output.chunks)) {
          console.log(`[generate-narration] Found ${output.chunks.length} chunks in Whisper output`);
          for (const chunk of output.chunks) {
            if (chunk.timestamp && chunk.text) {
              const [start, end] = chunk.timestamp;
              const word = chunk.text.trim();
              if (word && typeof start === "number" && typeof end === "number") {
                wordTimestamps.push({ word, start, end });
              }
            }
          }
          console.log(`[generate-narration] Parsed ${wordTimestamps.length} words from chunks`);
        }

        // Try segments.words (standard Whisper structure)
        if (wordTimestamps.length === 0 && output.segments) {
          for (const segment of output.segments) {
            if (segment.words) {
              for (const wordData of segment.words) {
                wordTimestamps.push({
                  word: wordData.word.trim(),
                  start: wordData.start,
                  end: wordData.end,
                });
              }
            }
          }
        }

        // Try top-level words array
        if (wordTimestamps.length === 0 && output.words) {
          for (const wordData of output.words) {
            wordTimestamps.push({
              word: wordData.word.trim(),
              start: wordData.start,
              end: wordData.end,
            });
          }
        }
      }

      console.log(`[generate-narration] Got ${wordTimestamps.length} word timestamps from Whisper`);

      // Validate and align timestamps with source text
      let finalTimestamps = wordTimestamps;
      let alignmentQuality: number | undefined;

      if (wordTimestamps.length > 0) {
        const validation = validateTimestamps(trimmedText, wordTimestamps);

        if (validation.valid) {
          // Attempt word alignment
          const aligned = alignWordsWithTimestamps(trimmedText, wordTimestamps);

          if (aligned) {
            finalTimestamps = alignedWordsToTimestamps(aligned);
            alignmentQuality =
              aligned.reduce((sum, w) => sum + w.confidence, 0) / aligned.length;
            console.log(
              `[generate-narration] Word alignment successful. Quality: ${(
                (alignmentQuality || 0) * 100
              ).toFixed(1)}%`
            );
          } else {
            console.warn(
              `[generate-narration] Word alignment failed, using raw Whisper output`
            );
          }
        } else {
          console.warn(
            `[generate-narration] Timestamp validation failed: ${validation.reason}`
          );
        }
      }

      // Upload timestamps as JSON file to storage (backup)
      let timestampsUrl: string | undefined;
      if (finalTimestamps.length > 0) {
        const timestampsPath = filePath.replace(`.${ext}`, "_timestamps.json");
        const timestampsBuffer = Buffer.from(JSON.stringify(finalTimestamps));

        const { error: timestampsUploadError } = await supabase.storage.from(bucket).upload(timestampsPath, timestampsBuffer, {
          contentType: "application/json",
          upsert: true, // Allow overwriting if regenerating
        });

        if (timestampsUploadError) {
          console.error(`[generate-narration] Failed to upload timestamps to storage:`, timestampsUploadError);
          // Continue anyway - we'll save to database
        } else {
          const { data: timestampsUrlData } = supabase.storage
            .from(bucket)
            .getPublicUrl(timestampsPath);

          timestampsUrl = timestampsUrlData.publicUrl;
          console.log(`[generate-narration] Timestamps uploaded to storage: ${timestampsUrl}`);
        }
      } else {
        console.warn(`[generate-narration] No timestamps to upload (finalTimestamps is empty)`);
      }

      // Save timestamps to database for fast access
      try {
        const bookIdBigInt = BigInt(bookId);
        const now = new Date();

        console.log(`[generate-narration] Saving to database - bookId: ${bookId}, pageNumber: ${pageNumber}, timestamps count: ${finalTimestamps.length}`);

        const updateResult = await prisma.pages.updateMany({
          where: {
            book_id: bookIdBigInt,
            page_number: pageNumber,
          },
          data: {
            narration_url: urlData.publicUrl,
            narration_timestamps: finalTimestamps as Prisma.InputJsonValue,
            updated_at: now,
          },
        });

        console.log(`[generate-narration] Database update result: ${updateResult.count} rows updated`);

        if (updateResult.count === 0) {
          console.warn(`[generate-narration] No page found to update! Creating page first...`);
          // Try to create the page if it doesn't exist
          await prisma.pages.create({
            data: {
              book_id: bookIdBigInt,
              page_number: pageNumber,
              narration_url: urlData.publicUrl,
              narration_timestamps: finalTimestamps as Prisma.InputJsonValue,
              inserted_at: now,
              updated_at: now,
            },
          });
          console.log(`[generate-narration] Created new page with timestamps`);
        }
      } catch (dbError) {
        console.error("[generate-narration] Failed to save timestamps to database:", dbError);
        // Continue - storage backup exists
      }

      if (finalTimestamps.length > 0) {
        return NextResponse.json({
          url: urlData.publicUrl,
          path: filePath,
          timestampsUrl,
          wordTimestamps: finalTimestamps,
          alignmentQuality,
        });
      }
    } catch (whisperError) {
      console.error("[generate-narration] Whisper error (continuing without timestamps):", whisperError);
      // Continue without timestamps - not a fatal error
    }

    return NextResponse.json({
      url: urlData.publicUrl,
      path: filePath,
      wordTimestamps: [],
    });
  } catch (error) {
    console.error("[generate-narration] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate narration." },
      { status: 500 }
    );
  }
}
