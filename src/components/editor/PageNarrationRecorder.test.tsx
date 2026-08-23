import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PageNarrationRecorder } from "./PageNarrationRecorder";

class FakeMediaRecorder {
  static isTypeSupported(type: string) {
    return type.startsWith("audio/webm");
  }

  state: RecordingState = "inactive";
  mimeType: string;
  ondataavailable: ((event: BlobEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  onstop: (() => void) | null = null;

  constructor(_stream: MediaStream, options?: MediaRecorderOptions) {
    this.mimeType = options?.mimeType || "audio/webm";
  }

  start() {
    this.state = "recording";
  }

  stop() {
    this.state = "inactive";
    this.ondataavailable?.({ data: new Blob(["voice"], { type: this.mimeType }) } as BlobEvent);
    this.onstop?.();
  }
}

describe("PageNarrationRecorder", () => {
  const track = { stop: vi.fn() };
  const onSave = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    onSave.mockResolvedValue(undefined);
    vi.stubGlobal("MediaRecorder", FakeMediaRecorder);
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [track] }) },
    });
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:preview");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("records, previews, and saves the active page", async () => {
    render(<PageNarrationRecorder pageNumber={2} onSave={onSave} />);

    fireEvent.click(screen.getByRole("button", { name: "Record page 2" }));
    const stop = await screen.findByRole("button", { name: "Stop recording page 2" });
    fireEvent.click(stop);
    fireEvent.click(await screen.findByRole("button", { name: "Use recording" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    const [file, durationMs] = onSave.mock.calls[0];
    expect(file).toBeInstanceOf(File);
    expect(file.name).toBe("page-2.webm");
    expect(durationMs).toBeGreaterThan(0);
    expect(track.stop).toHaveBeenCalled();
  });
});
