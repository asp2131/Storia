import { FFmpeg } from "@ffmpeg/ffmpeg";
import type { WordTimestamp } from "./elevenlabs";
import { readFile } from "fs/promises";
import { join } from "path";

const GAP_SECONDS = 0.75;

let ffmpegInstance: FFmpeg | null = null;
let loadingPromise: Promise<FFmpeg> | null = null;

async function getFFmpeg(): Promise<FFmpeg> {
  if (ffmpegInstance) return ffmpegInstance;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    const ffmpeg = new FFmpeg();

    // Load core from node_modules on the server
    const corePath = join(
      process.cwd(),
      "node_modules/@ffmpeg/core/dist/esm"
    );
    const coreJS = await readFile(join(corePath, "ffmpeg-core.js"));
    const coreWasm = await readFile(join(corePath, "ffmpeg-core.wasm"));

    const coreBlob = new Blob([coreJS], { type: "text/javascript" });
    const wasmBlob = new Blob([coreWasm], { type: "application/wasm" });
    const coreURL = URL.createObjectURL(coreBlob);
    const wasmURL = URL.createObjectURL(wasmBlob);

    await ffmpeg.load({ coreURL, wasmURL });
    ffmpegInstance = ffmpeg;
    loadingPromise = null;
    return ffmpeg;
  })();

  return loadingPromise;
}

// Monotonic counter to namespace concurrent stitching operations in the virtual FS
let stitchCounter = 0;

/**
 * Concatenates multiple MP3 audio buffers with a silence gap between each,
 * and returns combined timestamps offset by cumulative duration + gaps.
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
  const ffmpeg = await getFFmpeg();

  // Namespace files to avoid collisions between concurrent requests
  const ns = `job${++stitchCounter}`;

  // Write each track as a file
  const inputFiles: string[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const filename = `${ns}_track_${i}.mp3`;
    await ffmpeg.writeFile(filename, new Uint8Array(sorted[i].audioBuffer));
    inputFiles.push(filename);
  }

  const outputFile = `${ns}_output.mp3`;

  // Build input args for each track file
  const inputArgs: string[] = [];
  for (let i = 0; i < inputFiles.length; i++) {
    inputArgs.push("-i", inputFiles[i]);
  }

  // Build complex filter: [0:a][silence][1:a][silence]...[N:a] concat
  const totalSegments = inputFiles.length * 2 - 1; // tracks + silence gaps
  let filterComplex = "";
  const concatInputs: string[] = [];
  let silenceIdx = 0;

  for (let i = 0; i < inputFiles.length; i++) {
    concatInputs.push(`[${i}:a]`);

    if (i < inputFiles.length - 1) {
      const silenceLabel = `s${silenceIdx}`;
      filterComplex += `anullsrc=r=44100:cl=stereo[${silenceLabel}r];[${silenceLabel}r]atrim=0:${GAP_SECONDS},asetpts=PTS-STARTPTS[${silenceLabel}];`;
      concatInputs.push(`[${silenceLabel}]`);
      silenceIdx++;
    }
  }

  filterComplex += `${concatInputs.join("")}concat=n=${totalSegments}:v=0:a=1[out]`;

  try {
    await ffmpeg.exec([
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

    const outputData = await ffmpeg.readFile(outputFile);
    const stitchedBuffer = Buffer.from(
      outputData instanceof Uint8Array
        ? outputData
        : new TextEncoder().encode(outputData as string)
    );

    // Build combined timestamps with offsets
    const combinedTimestamps = combineWordTimestamps(sorted, GAP_SECONDS);

    return { stitchedBuffer, combinedTimestamps };
  } finally {
    // Always clean up files in ffmpeg virtual FS
    for (const f of inputFiles) {
      await ffmpeg.deleteFile(f).catch(() => {});
    }
    await ffmpeg.deleteFile(outputFile).catch(() => {});
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

    // Calculate track duration from last word's end time
    if (timestamps.length > 0) {
      const trackEnd = timestamps[timestamps.length - 1].end;
      cumulativeOffset += trackEnd;
    }

    // Add gap offset (except after the last track)
    if (i < tracks.length - 1) {
      cumulativeOffset += gapSeconds;
    }
  }

  return combined;
}
