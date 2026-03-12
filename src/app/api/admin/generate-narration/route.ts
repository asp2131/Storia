import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import {
  normalizeVoiceSettings,
  resolveElevenLabsVoice,
  synthesizeSpeech,
  synthesizeSpeechWithTimestamps,
} from "@/lib/elevenlabs";
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


export async function POST(request: NextRequest) {
  const supabase = buildSupabaseClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Missing Supabase configuration." },
      { status: 500 }
    );
  }

  if (!process.env.ELEVENLABS_API_KEY) {
    return NextResponse.json(
      {
        error:
          "Missing ElevenLabs API key. Please set ELEVENLABS_API_KEY in your environment.",
      },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const { text, bookId, pageNumber, voice, voiceSettings } = body;

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

    console.log(
      `[generate-narration] Generating for book ${bookId}, page ${pageNumber}`
    );

    const { voiceId, voiceName } = await resolveElevenLabsVoice(
      typeof voice === "string" ? voice : undefined
    );

    const normalizedVoiceSettings = normalizeVoiceSettings(voiceSettings);

    const narrationResult = await synthesizeSpeechWithTimestamps({
      text: trimmedText,
      voiceId,
      speed: normalizedVoiceSettings.speed,
      style: normalizedVoiceSettings.style,
      useSpeakerBoost: normalizedVoiceSettings.useSpeakerBoost,
    });

    const audioBuffer = narrationResult.audioBuffer;
    const contentType = narrationResult.contentType || "audio/mpeg";

    let ext = "mp3";
    if (contentType.includes("ogg")) {
      ext = "ogg";
    } else if (contentType.includes("wav")) {
      ext = "wav";
    }

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

    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(filePath);

    console.log(`[generate-narration] Uploaded to: ${urlData.publicUrl}`);

    const generatedWordTimestamps = narrationResult.wordTimestamps || [];
    console.log(
      `[generate-narration] Got ${generatedWordTimestamps.length} word timestamps from ElevenLabs`
    );

    let finalTimestamps = generatedWordTimestamps;
    let alignmentQuality: number | undefined;

    if (generatedWordTimestamps.length > 0) {
      const validation = validateTimestamps(trimmedText, generatedWordTimestamps);

      if (validation.valid) {
        const aligned = alignWordsWithTimestamps(trimmedText, generatedWordTimestamps);

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
            `[generate-narration] Word alignment failed, using raw ElevenLabs output`
          );
        }
      } else {
        console.warn(
          `[generate-narration] Timestamp validation failed: ${validation.reason}`
        );
      }
    }

    let timestampsUrl: string | undefined;
    if (finalTimestamps.length > 0) {
      const timestampsPath = filePath.replace(`.${ext}`, "_timestamps.json");
      const timestampsBuffer = Buffer.from(JSON.stringify(finalTimestamps));

      const { error: timestampsUploadError } = await supabase.storage
        .from(bucket)
        .upload(timestampsPath, timestampsBuffer, {
          contentType: "application/json",
          upsert: true,
        });

      if (timestampsUploadError) {
        console.error(
          `[generate-narration] Failed to upload timestamps to storage:`,
          timestampsUploadError
        );
      } else {
        const { data: timestampsUrlData } = supabase.storage
          .from(bucket)
          .getPublicUrl(timestampsPath);

        timestampsUrl = timestampsUrlData.publicUrl;
        console.log(
          `[generate-narration] Timestamps uploaded to storage: ${timestampsUrl}`
        );
      }
    }

    let pronunciationMap: Record<string, string> = {};
    try {
      const allWords = trimmedText.split(/\s+/);
      const cleanedWords = allWords
        .map((w) => w.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, "").toLowerCase())
        .filter((w) => w.length > 0);
      const uniqueWords = Array.from(new Set(cleanedWords));

      console.log(
        `[generate-narration] Generating pronunciations for ${uniqueWords.length} unique words`
      );

      const batchSize = 5;
      for (let i = 0; i < uniqueWords.length; i += batchSize) {
        const batch = uniqueWords.slice(i, i + batchSize);
        console.log(
          `[generate-narration] Processing pronunciation batch ${
            Math.floor(i / batchSize) + 1
          }/${Math.ceil(uniqueWords.length / batchSize)}`
        );

        const results = await Promise.all(
          batch.map(async (wordValue) => {
            try {
              const wordAudio = await synthesizeSpeech({
                text: wordValue,
                voiceId,
                speed: normalizedVoiceSettings.speed,
                style: normalizedVoiceSettings.style,
                useSpeakerBoost: normalizedVoiceSettings.useSpeakerBoost,
              });

              let wordExt = "mp3";
              if (wordAudio.contentType.includes("ogg")) {
                wordExt = "ogg";
              } else if (wordAudio.contentType.includes("wav")) {
                wordExt = "wav";
              }

              const wordTimestamp = Date.now();
              const wordPath = `books/${bookId}/pronunciations/word_${wordValue}_${wordTimestamp}.${wordExt}`;

              const { error: wordUploadError } = await supabase.storage
                .from(bucket)
                .upload(wordPath, wordAudio.audioBuffer, {
                  contentType: wordAudio.contentType,
                  upsert: false,
                });

              if (wordUploadError) {
                console.warn(
                  `[generate-narration] Failed to upload pronunciation for "${wordValue}":`,
                  wordUploadError
                );
                return { word: wordValue, url: null };
              }

              const { data: wordUrlData } = supabase.storage
                .from(bucket)
                .getPublicUrl(wordPath);

              console.log(
                `[generate-narration] Pronunciation for "${wordValue}" uploaded: ${wordUrlData.publicUrl}`
              );
              return { word: wordValue, url: wordUrlData.publicUrl };
            } catch (wordError) {
              console.warn(
                `[generate-narration] Error generating pronunciation for "${wordValue}":`,
                wordError
              );
              return { word: wordValue, url: null };
            }
          })
        );

        for (const result of results) {
          if (result.url) {
            pronunciationMap[result.word] = result.url;
          }
        }
      }

      console.log(
        `[generate-narration] Generated ${
          Object.keys(pronunciationMap).length
        } word pronunciations`
      );
    } catch (pronError) {
      console.error(
        "[generate-narration] Word pronunciation generation failed (continuing):",
        pronError
      );
      pronunciationMap = {};
    }

    try {
      const bookIdBigInt = BigInt(bookId);
      const now = new Date();

      console.log(
        `[generate-narration] Saving to database - bookId: ${bookId}, pageNumber: ${pageNumber}, timestamps count: ${finalTimestamps.length}`
      );

      const updateResult = await prisma.pages.updateMany({
        where: {
          book_id: bookIdBigInt,
          page_number: pageNumber,
        },
        data: {
          narration_url: urlData.publicUrl,
          narration_timestamps: finalTimestamps as Prisma.InputJsonValue,
          word_pronunciations: pronunciationMap as Prisma.InputJsonValue,
          updated_at: now,
        },
      });

      console.log(
        `[generate-narration] Database update result: ${updateResult.count} rows updated`
      );

      if (updateResult.count === 0) {
        console.warn(
          `[generate-narration] No page found to update! Creating page first...`
        );
        await prisma.pages.create({
          data: {
            book_id: bookIdBigInt,
            page_number: pageNumber,
            narration_url: urlData.publicUrl,
            narration_timestamps: finalTimestamps as Prisma.InputJsonValue,
            word_pronunciations: pronunciationMap as Prisma.InputJsonValue,
            inserted_at: now,
            updated_at: now,
          },
        });
        console.log(`[generate-narration] Created new page with timestamps`);
      }
    } catch (dbError) {
      console.error(
        "[generate-narration] Failed to save timestamps to database:",
        dbError
      );
    }

    return NextResponse.json({
      url: urlData.publicUrl,
      path: filePath,
      timestampsUrl,
      wordTimestamps: finalTimestamps,
      alignmentQuality,
      wordPronunciations: pronunciationMap,
      voice: {
        id: voiceId,
        name: voiceName,
      },
    });
  } catch (error) {
    console.error("[generate-narration] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate narration." },
      { status: 500 }
    );
  }
}
