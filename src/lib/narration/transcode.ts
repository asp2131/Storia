import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { getFfmpegPath } from "@/lib/audio-stitcher";

const execFileAsync = promisify(execFile);

const BITRATE = 128_000;

/**
 * Normalise any recorded or uploaded audio to the MP3 shape ElevenLabs
 * narration already has, so every reader plays (and highlights) it the same.
 *
 * Why: Chrome's MediaRecorder writes Opus inside fragmented MP4. Web plays it;
 * AVPlayer on older iOS does not, which leaves the mobile reader with no
 * narration position and therefore no word highlighting.
 *
 * Throws if ffmpeg cannot decode the input — callers map that to a 415.
 */
export async function transcodeToMp3(
  input: Buffer
): Promise<{ audio: Buffer; durationSeconds: number }> {
  const dir = join("/tmp", `narration-${randomUUID()}`);
  await mkdir(dir, { recursive: true });
  // Temp files, not pipes: an .m4a with its moov atom at the end is not
  // decodable from a non-seekable stdin.
  const source = join(dir, "in");
  const target = join(dir, "out.mp3");

  try {
    await writeFile(source, input);
    await execFileAsync(
      getFfmpegPath(),
      [
        "-nostdin", "-loglevel", "error", "-y",
        "-i", source,
        "-vn", "-map_metadata", "-1",
        "-ac", "1", "-ar", "44100",
        "-c:a", "libmp3lame", "-b:a", String(BITRATE),
        // No Xing/ID3 header: the file is pure CBR frames, so size ↔ duration is exact.
        "-write_xing", "0", "-id3v2_version", "0",
        target,
      ],
      { timeout: 120_000 }
    );

    const { size } = await stat(target);
    if (size === 0) throw new Error("ffmpeg produced no audio");
    return { audio: await readFile(target), durationSeconds: (size * 8) / BITRATE };
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
