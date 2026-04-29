import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import {
  normalizeVoiceSettings,
  resolveElevenLabsVoice,
  synthesizeSpeechWithTimestamps,
} from "@/lib/elevenlabs";
import {
  alignWordsWithTimestamps,
  alignedWordsToTimestamps,
  validateTimestamps,
} from "@/lib/wordAlignment";
import {
  extractUniquePronunciationTokens,
  type WordPronunciationEntry,
} from "@/lib/pronunciation";
import { generatePronunciationEntries } from "@/lib/pronunciationGeneration";
import { validatePronunciationManifest } from "@/lib/pronunciationValidation";

const supabaseUrl =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

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

    let pronunciationMap: Record<string, WordPronunciationEntry> = {};
    try {
      const uniqueWords = extractUniquePronunciationTokens(trimmedText);
      console.log(
        `[generate-narration] Generating pronunciations for ${uniqueWords.length} unique words`
      );

      const genResult = await generatePronunciationEntries({
        supabase,
        bucket,
        bookId,
        voiceId,
        voiceSettings: normalizedVoiceSettings,
        words: uniqueWords,
      });
      pronunciationMap = genResult.pronunciationMap;

      console.log(
        `[generate-narration] Pronunciation stats: generated=${genResult.stats.generated} failed=${genResult.stats.failed} withBreakdown=${genResult.stats.withBreakdown}`
      );
    } catch (pronError) {
      console.error(
        "[generate-narration] Word pronunciation generation failed (continuing):",
        pronError
      );
      pronunciationMap = {};
    }

    // ── Publish-time validation (Ticket 1.3) ─────────────────────────────
    // Validate the generated pronunciation map against the page text before
    // persistence.  Bad entries are logged and excluded; we never hard-block.
    const validation = validatePronunciationManifest(trimmedText, pronunciationMap);
    let pronunciationMapToStore = pronunciationMap;

    if (!validation.ok) {
      console.warn(
        `[generate-narration] Pronunciation validation found ${validation.issues.length} issue(s):`,
        validation.issues.map((issue) => ({
          kind: issue.kind,
          key: issue.key,
          message: issue.message,
        }))
      );
      // Persist only the entries that passed validation.
      pronunciationMapToStore = validation.validEntries;
      console.log(
        `[generate-narration] Persisting ${Object.keys(pronunciationMapToStore).length} valid pronunciation entries (excluded ${Object.keys(pronunciationMap).length - Object.keys(pronunciationMapToStore).length} invalid).`
      );
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
          word_pronunciations: pronunciationMapToStore as Prisma.InputJsonValue,
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
            word_pronunciations: pronunciationMapToStore as Prisma.InputJsonValue,
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
      wordPronunciations: pronunciationMapToStore,
      pronunciationValidation: {
        ok: validation.ok,
        issueCount: validation.issues.length,
        issues: validation.issues,
      },
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
