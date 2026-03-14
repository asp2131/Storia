import { execFile } from "child_process";
import { writeFile, readFile, unlink, mkdtemp } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { promisify } from "util";
import type { WordTimestamp } from "./elevenlabs";

const execFileAsync = promisify(execFile);

const GAP_SECONDS = 0.75;

/**
 * Concatenates multiple MP3 audio buffers with a silence gap between each,
 * using the system ffmpeg binary. Returns the stitched buffer and combined
 * word timestamps offset by cumulative duration + gaps.
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

  // Single track — no stitching needed
  if (tracks.length === 1) {
    return {
      stitchedBuffer: tracks[0].audioBuffer,
      combinedTimestamps: tracks[0].wordTimestamps,
    };
  }

  const sorted = [...tracks].sort((a, b) => a.sortOrder - b.sortOrder);

  // Create a temp directory for this stitching job
  const tempDir = await mkdtemp(join(tmpdir(), "storia-stitch-"));
  const inputFiles: string[] = [];
  const outputFile = join(tempDir, "output.mp3");

  try {
    // Write each track to a temp file
    for (let i = 0; i < sorted.length; i++) {
      const filepath = join(tempDir, `track_${i}.mp3`);
      await writeFile(filepath, sorted[i].audioBuffer);
      inputFiles.push(filepath);
    }

    // Build ffmpeg args with complex filter for silence gaps
    const inputArgs: string[] = [];
    for (const f of inputFiles) {
      inputArgs.push("-i", f);
    }

    const totalSegments = inputFiles.length * 2 - 1;
    let filterComplex = "";
    const concatInputs: string[] = [];
    let silenceIdx = 0;

    for (let i = 0; i < inputFiles.length; i++) {
      concatInputs.push(`[${i}:a]`);

      if (i < inputFiles.length - 1) {
        const label = `s${silenceIdx}`;
        filterComplex += `anullsrc=r=44100:cl=stereo[${label}r];[${label}r]atrim=0:${GAP_SECONDS},asetpts=PTS-STARTPTS[${label}];`;
        concatInputs.push(`[${label}]`);
        silenceIdx++;
      }
    }

    filterComplex += `${concatInputs.join("")}concat=n=${totalSegments}:v=0:a=1[out]`;

    await execFileAsync("ffmpeg", [
      "-y",
      ...inputArgs,
      "-filter_complex",
      filterComplex,
      "-map",
      "[out]",
      "-codec:a",
      "libmp3lame",
      "-b:a",
      "192k",
      outputFile,
    ]);

    const stitchedBuffer = await readFile(outputFile);
    const combinedTimestamps = combineWordTimestamps(sorted, GAP_SECONDS);

    return { stitchedBuffer: Buffer.from(stitchedBuffer), combinedTimestamps };
  } finally {
    // Clean up temp files
    for (const f of inputFiles) {
      await unlink(f).catch(() => {});
    }
    await unlink(outputFile).catch(() => {});
    // Remove temp directory (will succeed since it's now empty)
    const { rmdir } = await import("fs/promises");
    await rmdir(tempDir).catch(() => {});
  }
}

/**
 * Combines word timestamps from multiple tracks, offsetting each track's
 * timestamps by the cumulative duration of prior tracks + silence gaps.
 */
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
