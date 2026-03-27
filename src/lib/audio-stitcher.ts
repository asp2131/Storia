/**
 * audio-stitcher.ts — Concatenates multiple MP3 tracks with silence gaps
 * using ffmpeg-static. Deployed on Vercel serverless (writes temp files to /tmp).
 *
 * Drop-in replacement: same export name, same input/output types.
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeFile, readFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { WordTimestamp } from "./elevenlabs";

const execFileAsync = promisify(execFile);

const GAP_SECONDS = 0.75;

// ---------------------------------------------------------------------------
// Lazy ffmpeg binary resolution (singleton)
// ---------------------------------------------------------------------------

let _ffmpegPath: string | null = null;

function getFfmpegPath(): string {
  if (_ffmpegPath) return _ffmpegPath;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const resolved = require("ffmpeg-static") as string;
    if (!resolved) throw new Error("resolved to falsy value");
    _ffmpegPath = resolved;
    return _ffmpegPath;
  } catch (err) {
    throw new Error(
      "ffmpeg-static is not installed. Run: npm install ffmpeg-static\n" +
        `Original error: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

// ---------------------------------------------------------------------------
// Temp directory helpers
// ---------------------------------------------------------------------------

async function makeTempDir(): Promise<string> {
  const dir = join("/tmp", `stitch-${randomUUID()}`);
  await mkdir(dir, { recursive: true });
  return dir;
}

async function cleanupTempDir(dir: string): Promise<void> {
  try {
    await rm(dir, { recursive: true, force: true });
  } catch {
    // Best-effort — Vercel /tmp is ephemeral
  }
}

// ---------------------------------------------------------------------------
// Core: stitchAudioTracks
// ---------------------------------------------------------------------------

/**
 * Concatenates multiple MP3 audio buffers with silence gaps using ffmpeg.
 *
 * Uses the `concat` audio filter (decode + re-encode) which produces a
 * spec-compliant single MP3 with correct headers. Silence is generated
 * inline via `anullsrc`.
 */
export async function stitchAudioTracks(
  tracks: Array<{
    audioBuffer: Buffer;
    wordTimestamps: WordTimestamp[];
    sortOrder: number;
  }>
): Promise<{
  stitchedBuffer: Buffer;
  combinedTimestamps: WordTimestamp[];
}> {
  if (tracks.length === 0) {
    throw new Error("No tracks to stitch.");
  }

  const sorted = [...tracks].sort((a, b) => a.sortOrder - b.sortOrder);

  // Single track — no stitching needed
  if (sorted.length === 1) {
    return {
      stitchedBuffer: sorted[0].audioBuffer,
      combinedTimestamps: sorted[0].wordTimestamps,
    };
  }

  const startTime = Date.now();
  const ffmpeg = getFfmpegPath();
  const tempDir = await makeTempDir();

  try {
    // Write track buffers to temp files
    const trackPaths: string[] = [];
    await Promise.all(
      sorted.map((track, i) => {
        const p = join(tempDir, `track_${i}.mp3`);
        trackPaths.push(p);
        return writeFile(p, track.audioBuffer);
      })
    );

    // Build ffmpeg args:
    //   -i track_0.mp3 -i track_1.mp3 ...
    //   -filter_complex "[0:a][gap0][1:a][gap1][2:a]concat=n=5:v=0:a=1[out]"
    //   where each gap is: anullsrc=r=44100:cl=stereo,atrim=0:0.75,asetpts=PTS-STARTPTS
    const inputArgs: string[] = ["-y"];
    for (const p of trackPaths) {
      inputArgs.push("-i", p);
    }

    // Build filter_complex string
    const filterParts: string[] = [];
    const concatLabels: string[] = [];

    for (let i = 0; i < sorted.length; i++) {
      concatLabels.push(`[${i}:a]`);

      if (i < sorted.length - 1) {
        // Generate a silence segment for the gap
        filterParts.push(
          `anullsrc=r=44100:cl=stereo,atrim=0:${GAP_SECONDS},asetpts=PTS-STARTPTS[gap${i}]`
        );
        concatLabels.push(`[gap${i}]`);
      }
    }

    const totalSegments = concatLabels.length;
    filterParts.push(
      `${concatLabels.join("")}concat=n=${totalSegments}:v=0:a=1[out]`
    );

    const filterComplex = filterParts.join(";");

    const ffmpegArgs = [
      ...inputArgs,
      "-filter_complex",
      filterComplex,
      "-map",
      "[out]",
      "-c:a",
      "libmp3lame",
      "-b:a",
      "128k",
      "-ar",
      "44100",
      "-ac",
      "2",
      join(tempDir, "output.mp3"),
    ];

    try {
      await execFileAsync(ffmpeg, ffmpegArgs, {
        timeout: 30_000,
        maxBuffer: 50 * 1024 * 1024,
      });
    } catch (err) {
      const stderr =
        err instanceof Error ? (err as NodeJS.ErrnoException & { stderr?: string }).stderr ?? "" : "";
      throw new Error(
        `ffmpeg failed to stitch ${sorted.length} tracks.\n` +
          `This may indicate corrupted input audio from ElevenLabs.\n` +
          `ffmpeg stderr: ${stderr || (err instanceof Error ? err.message : String(err))}`
      );
    }

    const stitchedBuffer = await readFile(join(tempDir, "output.mp3"));
    const combinedTimestamps = combineWordTimestamps(sorted, GAP_SECONDS);

    const elapsed = Date.now() - startTime;
    console.log(
      `[audio-stitcher] Stitched ${sorted.length} tracks in ${elapsed}ms ` +
        `(${(stitchedBuffer.length / 1024).toFixed(1)}KB)`
    );

    return { stitchedBuffer, combinedTimestamps };
  } finally {
    await cleanupTempDir(tempDir);
  }
}

// ---------------------------------------------------------------------------
// Timestamp combiner (unchanged from original — this logic was correct)
// ---------------------------------------------------------------------------

function combineWordTimestamps(
  tracks: Array<{ wordTimestamps: WordTimestamp[] }>,
  gapSeconds: number
): WordTimestamp[] {
  const combined: WordTimestamp[] = [];
  let cumulativeOffset = 0;

  for (let i = 0; i < tracks.length; i++) {
    const timestamps = tracks[i].wordTimestamps;

    for (const wt of timestamps) {
      combined.push({
        word: wt.word,
        start: wt.start + cumulativeOffset,
        end: wt.end + cumulativeOffset,
      });
    }

    if (timestamps.length > 0) {
      const trackEnd = timestamps[timestamps.length - 1].end;
      cumulativeOffset += trackEnd;
    }

    if (i < tracks.length - 1) {
      cumulativeOffset += gapSeconds;
    }
  }

  return combined;
}
