import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";
import {
  extractStoragePath,
  normalizeVoiceSettings,
  resolveElevenLabsVoice,
  synthesizeSpeechWithTimestamps,
} from "@/lib/elevenlabs";
import { stitchAudioTracks } from "@/lib/audio-stitcher";

type OverlayNarrationItem = {
  overlayElementId: string;
  text: string;
  voiceId?: string;
  voiceName?: string;
  sortOrder?: number;
};

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
    const { bookId, pageNumber, items, voiceSettings } = body as {
      bookId?: string;
      pageNumber?: number;
      items?: OverlayNarrationItem[];
      voiceSettings?: {
        speed?: number;
        style?: number;
        useSpeakerBoost?: boolean;
      };
    };

    if (!bookId) {
      return NextResponse.json({ error: "Book ID is required." }, { status: 400 });
    }

    if (!pageNumber || pageNumber < 1) {
      return NextResponse.json(
        { error: "Valid page number is required." },
        { status: 400 }
      );
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "At least one overlay narration item is required." },
        { status: 400 }
      );
    }

    const cleanedItems = items
      .map((item, index) => ({
        overlayElementId: String(item.overlayElementId || "").trim(),
        text: String(item.text || "").trim(),
        voiceId: typeof item.voiceId === "string" ? item.voiceId.trim() : undefined,
        voiceName: typeof item.voiceName === "string" ? item.voiceName.trim() : undefined,
        sortOrder: typeof item.sortOrder === "number" ? item.sortOrder : index,
      }))
      .filter((item) => item.overlayElementId && item.text);

    if (cleanedItems.length === 0) {
      return NextResponse.json(
        { error: "No valid overlay narration items found." },
        { status: 400 }
      );
    }

    const bookIdBigInt = BigInt(bookId);

    const page = await prisma.pages.findFirst({
      where: {
        book_id: bookIdBigInt,
        page_number: pageNumber,
      },
      select: { id: true },
    });

    if (!page) {
      return NextResponse.json(
        { error: "Page not found. Save the page first before generating narration." },
        { status: 404 }
      );
    }

    const bucket =
      process.env.SUPABASE_STORAGE_BUCKET ||
      process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET ||
      "storia-storage";

    const results: Array<{
      overlayElementId: string;
      voiceId: string;
      voiceName?: string;
      audioUrl: string;
      audioBuffer: Buffer;
      wordTimestamps: Array<{ word: string; start: number; end: number }>;
      sortOrder: number;
    }> = [];

    const normalizedVoiceSettings = normalizeVoiceSettings(voiceSettings);

    for (const item of cleanedItems) {
      const resolvedVoice = await resolveElevenLabsVoice(item.voiceId || item.voiceName);

      // Delete the old audio file from Storage before replacing
      const existing = await prisma.$queryRaw<Array<{ audio_url: string }>>`
        SELECT audio_url FROM page_overlay_narrations
        WHERE page_id = ${page.id}
          AND overlay_element_id = ${item.overlayElementId}
          AND voice_id = ${resolvedVoice.voiceId}
        LIMIT 1
      `;
      if (existing[0]?.audio_url) {
        const oldPath = extractStoragePath(existing[0].audio_url, bucket);
        if (oldPath) {
          await supabase.storage.from(bucket).remove([oldPath]);
          console.log(`[generate-overlay-narration] Deleted old file: ${oldPath}`);
        }
      }

      const generated = await synthesizeSpeechWithTimestamps({
        text: item.text,
        voiceId: resolvedVoice.voiceId,
        speed: normalizedVoiceSettings.speed,
        style: normalizedVoiceSettings.style,
        useSpeakerBoost: normalizedVoiceSettings.useSpeakerBoost,
      });

      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(2, 8);
      const safeElementId = item.overlayElementId.replace(/[^a-zA-Z0-9_-]/g, "_");
      const filePath = `books/${bookId}/overlay-narration/page_${pageNumber}/element_${safeElementId}_${timestamp}_${random}.mp3`;

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filePath, generated.audioBuffer, {
          contentType: generated.contentType || "audio/mpeg",
          upsert: false,
        });

      if (uploadError) {
        return NextResponse.json(
          { error: `Failed to upload narration for element ${item.overlayElementId}.` },
          { status: 500 }
        );
      }

      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(filePath);

      const now = new Date();
      await prisma.$executeRaw`
        INSERT INTO page_overlay_narrations (
          page_id,
          overlay_element_id,
          voice_id,
          voice_name,
          text_content,
          audio_url,
          word_timestamps,
          sort_order,
          inserted_at,
          updated_at
        ) VALUES (
          ${page.id},
          ${item.overlayElementId},
          ${resolvedVoice.voiceId},
          ${resolvedVoice.voiceName || item.voiceName || null},
          ${item.text},
          ${urlData.publicUrl},
          ${JSON.stringify(generated.wordTimestamps)}::jsonb,
          ${item.sortOrder},
          ${now},
          ${now}
        )
        ON CONFLICT (page_id, overlay_element_id, voice_id)
        DO UPDATE SET
          voice_name = EXCLUDED.voice_name,
          text_content = EXCLUDED.text_content,
          audio_url = EXCLUDED.audio_url,
          word_timestamps = EXCLUDED.word_timestamps,
          sort_order = EXCLUDED.sort_order,
          updated_at = EXCLUDED.updated_at
      `;

      results.push({
        overlayElementId: item.overlayElementId,
        voiceId: resolvedVoice.voiceId,
        voiceName: resolvedVoice.voiceName,
        audioUrl: urlData.publicUrl,
        audioBuffer: generated.audioBuffer,
        wordTimestamps: generated.wordTimestamps,
        sortOrder: item.sortOrder,
      });
    }

    const ordered = [...results].sort((a, b) => a.sortOrder - b.sortOrder);

    // ── Stitch all tracks into a single narration file for v1 readers (Flutter) ──
    let stitchedUrl: string | null = null;
    let combinedTimestamps: Array<{ word: string; start: number; end: number }> = [];

    if (ordered.length > 0) {
      const trackBuffers = ordered.map((track) => ({
        audioBuffer: track.audioBuffer,
        wordTimestamps: track.wordTimestamps,
        sortOrder: track.sortOrder,
      }));

      const { stitchedBuffer, combinedTimestamps: combined } =
        await stitchAudioTracks(trackBuffers);
      combinedTimestamps = combined;

      // Upload stitched file
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(2, 8);
      const stitchedPath = `books/${bookId}/narration/page_${pageNumber}_stitched_${timestamp}_${random}.mp3`;

      // Delete old stitched narration file if it exists
      const existingPage = await prisma.pages.findFirst({
        where: { book_id: bookIdBigInt, page_number: pageNumber },
        select: { narration_url: true },
      });
      if (existingPage?.narration_url) {
        const oldPath = extractStoragePath(existingPage.narration_url, bucket);
        if (oldPath && oldPath.includes("_stitched_")) {
          await supabase.storage.from(bucket).remove([oldPath]);
        }
      }

      const { error: stitchUploadError } = await supabase.storage
        .from(bucket)
        .upload(stitchedPath, stitchedBuffer, {
          contentType: "audio/mpeg",
          upsert: false,
        });

      if (stitchUploadError) {
        console.error("[generate-overlay-narration] Failed to upload stitched file:", stitchUploadError);
      } else {
        const { data: stitchedUrlData } = supabase.storage.from(bucket).getPublicUrl(stitchedPath);
        stitchedUrl = stitchedUrlData.publicUrl;

        // Write stitched narration to pages table for v1 readers (Flutter)
        await prisma.pages.update({
          where: { id: page.id },
          data: {
            narration_url: stitchedUrl,
            narration_timestamps: combinedTimestamps as any,
          },
        });
      }
    }

    // Strip audioBuffer from response — client doesn't need raw bytes
    const responseTracks = ordered.map(({ audioBuffer: _, ...rest }) => rest);

    return NextResponse.json({
      pageId: page.id.toString(),
      tracks: responseTracks,
      count: responseTracks.length,
      mode: "overlay-multivoice",
      stitchedUrl,
      combinedTimestamps,
    });
  } catch (error) {
    console.error("[generate-overlay-narration] Error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Prisma.PrismaClientKnownRequestError
            ? error.message
            : error instanceof Error
              ? error.message
              : "Failed to generate overlay narration.",
      },
      { status: 500 }
    );
  }
}
