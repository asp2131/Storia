import { FFmpeg } from "@ffmpeg/ffmpeg";
import { toBlobURL } from "@ffmpeg/util";
import type { WordTimestamp } from "./elevenlabs";

const GAP_SECONDS = 0.75;
const FFMPEG_CORE_VERSION = "0.12.9";
const FFMPEG_CORE_BASE = `https://unpkg.com/@ffmpeg/core@${FFMPEG_CORE_VERSION}/dist/esm`;

let ffmpegInstance: FFmpeg | null = null;

async function getFFmpeg(): Promise<FFmpeg> {
  if (ffmpegInstance) return ffmpegInstance;

  const ffmpeg = new FFmpeg();

  const coreURL = await toBlobURL(
    `${FFMPEG_CORE_BASE}/ffmpeg-core.js`,
    "text/javascript"
  );
  const wasmURL = await toBlobURL(
    `${FFMPEG_CORE_BASE}/ffmpeg-core.wasm`,
    "application/wasm"
  );

  await ffmpeg.load({ coreURL, wasmURL });
  ffmpegInstance = ffmpeg;
  return ffmpeg;
}

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

  // Write each track as a file
  const inputFiles: string[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const filename = `track_${i}.mp3`;
    await ffmpeg.writeFile(filename, new Uint8Array(sorted[i].audioBuffer));
    inputFiles.push(filename);
  }

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
    "output.mp3",
  ]);

  const outputData = await ffmpeg.readFile("output.mp3");
  const stitchedBuffer = Buffer.from(
    outputData instanceof Uint8Array
      ? outputData
      : new TextEncoder().encode(outputData as string)
  );

  // Clean up files in ffmpeg virtual FS
  for (const f of inputFiles) {
    await ffmpeg.deleteFile(f);
  }
  await ffmpeg.deleteFile("output.mp3");

  // Build combined timestamps with offsets
  const combinedTimestamps = combineWordTimestamps(sorted, GAP_SECONDS);

  return { stitchedBuffer, combinedTimestamps };
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
