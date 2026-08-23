import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/child-auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { alignRecording } from "@/lib/narration/alignRecording";
import { buildPageReferenceWords } from "@/lib/narration/referenceWords";
import {
  MAX_RECORDING_BYTES,
  MAX_RECORDING_SECONDS,
  buildRecordingPath,
  extensionForContentType,
  isSupportedAudioType,
  removeRecordings,
  uploadRecording,
} from "@/lib/narration/storage";
import { narrationError, requireOwnedTrack, serializeTrackPage } from "@/lib/narration/tracks";

type BlobLike = { size: number; type: string; arrayBuffer: () => Promise<ArrayBuffer> };

function isBlobLike(value: unknown): value is BlobLike {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as BlobLike).arrayBuffer === "function" &&
    typeof (value as BlobLike).size === "number"
  );
}

/**
 * POST /api/narrations/pages
 *
 * Multipart: { trackId, pageNumber, durationMs, file }
 *
 * Uploads one page of a parent's recording, forced-aligns it against the page's
 * OWN text (never client-supplied text — the reference words must come from the
 * same source the reader renders), and upserts the row. Re-posting the same page
 * is a retake: the new object replaces the old, which is then deleted.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser();
    if ("error" in auth) return auth.error;

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return narrationError("invalid_request", "Expected multipart/form-data", 400);
    }

    const trackId = String(form.get("trackId") ?? "").trim();
    if (!trackId) {
      return narrationError("invalid_request", "trackId is required", 400, { field: "trackId" });
    }

    const owned = await requireOwnedTrack(trackId, auth.user.id);
    if ("error" in owned) return owned.error;
    const { track } = owned;

    const pageNumber = Number(form.get("pageNumber"));
    if (!Number.isInteger(pageNumber) || pageNumber < 1) {
      return narrationError("invalid_request", "pageNumber must be a positive integer", 400, {
        field: "pageNumber",
      });
    }

    // Duck-typed rather than `instanceof Blob`: the multipart parser yields
    // undici File objects, which are not instances of every runtime's Blob.
    const file = form.get("file") as BlobLike | null;
    if (!isBlobLike(file)) {
      return narrationError("invalid_request", "file is required", 400, { field: "file" });
    }

    const contentType = file.type || "audio/mp4";
    if (!isSupportedAudioType(contentType)) {
      return narrationError("unsupported_media_type", `Unsupported audio type: ${contentType}`, 415);
    }
    if (file.size > MAX_RECORDING_BYTES) {
      return narrationError("payload_too_large", "Recording is too large for one page", 413);
    }

    const durationMsRaw = Number(form.get("durationMs"));
    const durationMs = Number.isFinite(durationMsRaw) && durationMsRaw > 0 ? Math.round(durationMsRaw) : null;
    if (durationMs !== null && durationMs > MAX_RECORDING_SECONDS * 1000) {
      return narrationError("payload_too_large", "Recording is longer than 5 minutes", 413);
    }

    const page = await prisma.pages.findFirst({
      where: { book_id: track.book_id, page_number: pageNumber },
      select: { id: true, text_overlay: true, text_content: true },
    });

    if (!page) {
      return narrationError("not_found", `Page ${pageNumber} not found for this book`, 404);
    }

    const { tokens } = buildPageReferenceWords(page);
    if (tokens.length === 0) {
      return narrationError(
        "invalid_request",
        "This page has no text to align a recording against",
        422
      );
    }

    const audio = Buffer.from(await file.arrayBuffer());

    const alignment = await alignRecording({
      audio,
      contentType,
      // ElevenLabs sniffs the upload by extension; forceAlign() otherwise names
      // every file "recording.m4a", which silently degrades non-m4a uploads to
      // "fallback" timings. No-op for the mobile client, which sends audio/mp4.
      fileName: `page_${pageNumber}.${extensionForContentType(contentType)}`,
      tokens,
      durationSeconds: durationMs !== null ? durationMs / 1000 : 0,
    });

    const path = buildRecordingPath({
      userId: auth.user.id,
      bookId: track.book_id.toString(),
      trackId,
      pageNumber,
      contentType,
    });

    const audioUrl = await uploadRecording({ path, audio, contentType });

    const previous = await prisma.user_narration_page.findUnique({
      where: { track_id_page_id: { track_id: trackId, page_id: page.id } },
      select: { audio_path: true },
    });

    const row = await prisma.user_narration_page.upsert({
      where: { track_id_page_id: { track_id: trackId, page_id: page.id } },
      create: {
        track_id: trackId,
        page_id: page.id,
        audio_url: audioUrl,
        audio_path: path,
        duration_ms: durationMs,
        word_timestamps: alignment.timestamps as unknown as Prisma.InputJsonValue,
        word_count: tokens.length,
        alignment_status: alignment.status,
        alignment_loss: alignment.loss ?? null,
      },
      update: {
        audio_url: audioUrl,
        audio_path: path,
        duration_ms: durationMs,
        word_timestamps: alignment.timestamps as unknown as Prisma.InputJsonValue,
        word_count: tokens.length,
        alignment_status: alignment.status,
        alignment_loss: alignment.loss ?? null,
      },
      include: { page: { select: { page_number: true } } },
    });

    // Retake: drop the superseded object only after the row points at the new one.
    if (previous?.audio_path && previous.audio_path !== path) {
      await removeRecordings([previous.audio_path]);
    }

    return NextResponse.json({ page: serializeTrackPage(row) }, { status: 201 });
  } catch (error) {
    console.error("[narration] page upload failed:", error);
    return narrationError("internal_error", "Failed to save the recording", 500);
  }
}
