import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireBookAccess } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { alignRecording } from "@/lib/narration/alignRecording";
import { buildPageReferenceWords } from "@/lib/narration/referenceWords";
import { MAX_RECORDING_SECONDS, removeRecordings, uploadRecording } from "@/lib/narration/storage";
import { transcodeToMp3 } from "@/lib/narration/transcode";

// Uploads may be uncompressed WAV; everything is stored as ~1 MB/min MP3.
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

type RouteContext = {
  params: Promise<{ id: string; pageNumber: string }>;
};

type BlobLike = {
  size: number;
  type: string;
  arrayBuffer: () => Promise<ArrayBuffer>;
};

function isBlobLike(value: unknown): value is BlobLike {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof (value as BlobLike).size === "number" &&
      typeof (value as BlobLike).arrayBuffer === "function"
  );
}

export async function POST(request: NextRequest, context: RouteContext) {
  const admin = await requireBookAccess((await context.params).id);
  if (admin instanceof NextResponse) return admin;

  let bookId: bigint;
  let pageNumber: number;
  try {
    const params = await context.params;
    bookId = BigInt(params.id);
    pageNumber = Number(params.pageNumber);
    if (!Number.isInteger(pageNumber) || pageNumber < 1) throw new Error();
  } catch {
    return NextResponse.json({ error: "Invalid book or page number." }, { status: 400 });
  }

  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!isBlobLike(file) || file.size === 0) {
      return NextResponse.json({ error: "A recording is required." }, { status: 400 });
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: "Audio file is too large (50 MB max)." }, { status: 413 });
    }

    const page = await prisma.pages.findFirst({
      where: { book_id: bookId, page_number: pageNumber },
      select: { id: true, text_overlay: true, text_content: true },
    });
    if (!page) {
      return NextResponse.json({ error: "Page not found." }, { status: 404 });
    }

    const { tokens } = buildPageReferenceWords(page);
    if (tokens.length === 0) {
      return NextResponse.json(
        { error: "Add text to this page before recording narration." },
        { status: 422 }
      );
    }

    // Recordings and uploads arrive in whatever the browser or author had
    // (Opus-in-MP4, WebM, WAV…). Store one format every reader can play, and
    // align against those exact bytes so timings match what is heard.
    let audio: Buffer;
    let durationSeconds: number;
    try {
      ({ audio, durationSeconds } = await transcodeToMp3(Buffer.from(await file.arrayBuffer())));
    } catch (error) {
      console.warn("[narration-recording] Could not decode audio:", error);
      return NextResponse.json({ error: "That file could not be read as audio." }, { status: 415 });
    }
    if (durationSeconds > MAX_RECORDING_SECONDS) {
      return NextResponse.json({ error: "Narration is longer than 5 minutes." }, { status: 413 });
    }

    const contentType = "audio/mpeg";
    const extension = "mp3";
    const durationMs = Math.round(durationSeconds * 1000);
    const alignment = await alignRecording({
      audio,
      contentType,
      // ElevenLabs sniffs the upload by extension, so the name must match the bytes.
      fileName: `page_${pageNumber}.${extension}`,
      tokens,
      durationSeconds,
    });
    const stamp = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const path = `books/${bookId}/narration/recorded_page_${pageNumber}_${stamp}.${extension}`;
    const audioUrl = await uploadRecording({ path, audio, contentType });
    const now = new Date();

    try {
      // ponytail: superseded audio is reclaimed by storage-gc; eager cleanup risks deleting URLs still used by ranges.
      await prisma.$transaction([
        prisma.pages.update({
          where: { id: page.id },
          data: {
            narration_url: audioUrl,
            narration_timestamps: alignment.timestamps as unknown as Prisma.InputJsonValue,
            updated_at: now,
          },
        }),
        prisma.page_audio_assignments.deleteMany({
          where: { page_id: page.id, audio_type: "narration", scope: "single" },
        }),
        prisma.page_audio_assignments.create({
          data: {
            page_id: page.id,
            audio_url: audioUrl,
            audio_type: "narration",
            scope: "single",
            inserted_at: now,
            updated_at: now,
          },
        }),
        prisma.page_overlay_narrations.deleteMany({ where: { page_id: page.id } }),
      ]);
    } catch (error) {
      await removeRecordings([path]);
      throw error;
    }

    return NextResponse.json({
      url: audioUrl,
      wordTimestamps: alignment.timestamps,
      alignmentStatus: alignment.status,
      durationMs,
    });
  } catch (error) {
    console.error("[narration-recording] Failed:", error);
    return NextResponse.json({ error: "Failed to save narration recording." }, { status: 500 });
  }
}
