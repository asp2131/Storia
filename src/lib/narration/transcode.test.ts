// @vitest-environment node
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { getFfmpegPath } from "@/lib/audio-stitcher";
import { transcodeToMp3 } from "./transcode";

function sample(args: string[]): Buffer {
  return execFileSync(
    getFfmpegPath(),
    ["-loglevel", "error", "-f", "lavfi", "-i", "sine=frequency=440:duration=2", ...args, "pipe:1"],
    { maxBuffer: 16 * 1024 * 1024 }
  );
}

describe("transcodeToMp3", () => {
  it.each([
    // What Chrome's MediaRecorder produces for "audio/mp4" — the format that broke mobile.
    ["opus in fragmented mp4", ["-c:a", "libopus", "-movflags", "frag_keyframe+empty_moov", "-f", "mp4"]],
    ["wav upload", ["-f", "wav"]],
  ])("turns %s into an mp3 with the right duration", async (_name, args) => {
    const { audio, durationSeconds } = await transcodeToMp3(sample(args));

    expect(audio[0]).toBe(0xff); // MPEG frame sync, no ID3 prefix
    expect(durationSeconds).toBeGreaterThan(1.9);
    expect(durationSeconds).toBeLessThan(2.2);
  });

  it("rejects a file that is not audio", async () => {
    await expect(transcodeToMp3(Buffer.from("not audio at all"))).rejects.toThrow();
  });
});
