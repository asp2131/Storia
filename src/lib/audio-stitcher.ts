import type { WordTimestamp } from "./elevenlabs";

const GAP_SECONDS = 0.75;

/**
 * A minimal silent MP3 frame (MPEG1 Layer 3, 128kbps, 44100Hz, stereo).
 * Each frame is 1152 samples at 44100Hz ≈ 26.122ms.
 * The frame is valid but produces silence.
 */
const SILENT_MP3_FRAME = Buffer.from([
  // MPEG1, Layer 3, 128kbps, 44100Hz, stereo – sync word + header
  0xff, 0xfb, 0x90, 0x00,
  // Side information (17 bytes for stereo MPEG1 Layer 3) – all zeros = silence
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00,
  // Padding to reach frame size of 417 bytes (128kbps, 44100Hz)
  ...new Array(417 - 4 - 17).fill(0x00),
]);

/** Duration of one silent MP3 frame in seconds */
const FRAME_DURATION = 1152 / 44100;

/**
 * Generates a buffer of silent MP3 frames for the given duration.
 */
function generateSilence(durationSeconds: number): Buffer {
  const frameCount = Math.max(1, Math.round(durationSeconds / FRAME_DURATION));
  const frames: Buffer[] = [];
  for (let i = 0; i < frameCount; i++) {
    frames.push(SILENT_MP3_FRAME);
  }
  return Buffer.concat(frames);
}

/**
 * Concatenates multiple MP3 audio buffers with a silence gap between each.
 * Pure JS implementation — no ffmpeg required.
 * Returns the stitched buffer and combined word timestamps offset by
 * cumulative duration + gaps.
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
  const silenceBuffer = generateSilence(GAP_SECONDS);

  // Concatenate MP3 buffers with silence gaps between them
  const parts: Buffer[] = [];
  for (let i = 0; i < sorted.length; i++) {
    parts.push(sorted[i].audioBuffer);
    if (i < sorted.length - 1) {
      parts.push(silenceBuffer);
    }
  }

  const stitchedBuffer = Buffer.concat(parts);
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
