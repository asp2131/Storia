import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { WordTimestamp } from "@/lib/elevenlabs";

/** Shared serialization + ownership checks for the narration routes. */

export const MAX_TRACKS_PER_BOOK = 3;

export function narrationError(
  code: string,
  message: string,
  status: number,
  details?: Record<string, unknown>
) {
  return NextResponse.json({ error: { code, message, ...(details ? { details } : {}) } }, { status });
}

export interface SerializedNarrationPage {
  pageId: string;
  pageNumber: number;
  audioUrl: string;
  durationMs: number | null;
  wordTimestamps: WordTimestamp[];
  wordCount: number;
  alignmentStatus: string;
}

export interface SerializedNarrationTrack {
  id: string;
  bookId: string;
  label: string;
  status: string;
  createdAt: string;
  pages: SerializedNarrationPage[];
}

type TrackPageRow = {
  page_id: bigint;
  audio_url: string;
  duration_ms: number | null;
  word_timestamps: unknown;
  word_count: number;
  alignment_status: string;
  page?: { page_number: number } | null;
};

type TrackRow = {
  id: string;
  book_id: bigint;
  label: string;
  status: string;
  createdAt: Date;
  pages?: TrackPageRow[];
};

function toWordTimestamps(raw: unknown): WordTimestamp[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const { word, start, end } = entry as Record<string, unknown>;
    if (typeof word !== "string") return [];
    return [
      {
        word,
        start: typeof start === "number" ? start : 0,
        end: typeof end === "number" ? end : 0,
      },
    ];
  });
}

export function serializeTrackPage(row: TrackPageRow): SerializedNarrationPage {
  return {
    pageId: row.page_id.toString(),
    pageNumber: row.page?.page_number ?? 0,
    audioUrl: row.audio_url,
    durationMs: row.duration_ms,
    wordTimestamps: toWordTimestamps(row.word_timestamps),
    wordCount: row.word_count,
    alignmentStatus: row.alignment_status,
  };
}

export function serializeTrack(row: TrackRow): SerializedNarrationTrack {
  return {
    id: row.id,
    bookId: row.book_id.toString(),
    label: row.label,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    pages: (row.pages ?? [])
      .map(serializeTrackPage)
      .sort((a, b) => a.pageNumber - b.pageNumber),
  };
}

export interface OwnedTrack {
  id: string;
  userId: string;
  book_id: bigint;
  label: string;
  status: string;
}

/**
 * Resolve a track the caller owns, or an error response.
 *
 * The return type is explicit: inferred union members pick up optional
 * `undefined` siblings, which leaks `NextResponse | undefined` into callers.
 */
export async function requireOwnedTrack(
  trackId: string,
  userId: string
): Promise<{ error: NextResponse } | { track: OwnedTrack }> {
  const track = await prisma.user_narration_track.findUnique({
    where: { id: trackId },
    select: { id: true, userId: true, book_id: true, label: true, status: true },
  });

  if (!track) {
    return { error: narrationError("not_found", "Narration track not found", 404) };
  }
  // Same response for "not yours" as "missing" would be friendlier to probe;
  // 403 is fine here because track ids are cuids, not enumerable.
  if (track.userId !== userId) {
    return { error: narrationError("forbidden", "Narration track belongs to another account", 403) };
  }

  return { track };
}
