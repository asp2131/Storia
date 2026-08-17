import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  mockGetAuthenticatedUser,
  mockPrisma,
  mockAlignRecording,
  mockUploadRecording,
  mockRemoveRecordings,
} = vi.hoisted(() => ({
  mockGetAuthenticatedUser: vi.fn(),
  mockPrisma: {
    user_narration_track: { findUnique: vi.fn() },
    user_narration_page: { findUnique: vi.fn(), upsert: vi.fn() },
    pages: { findFirst: vi.fn() },
  },
  mockAlignRecording: vi.fn(),
  mockUploadRecording: vi.fn(),
  mockRemoveRecordings: vi.fn(),
}));

vi.mock("@/lib/child-auth", () => ({ getAuthenticatedUser: mockGetAuthenticatedUser }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/narration/alignRecording", () => ({ alignRecording: mockAlignRecording }));
vi.mock("@/lib/narration/storage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/narration/storage")>();
  return {
    ...actual,
    uploadRecording: mockUploadRecording,
    removeRecordings: mockRemoveRecordings,
  };
});

import { POST } from "@/app/api/narrations/pages/route";

const TRACK = { id: "track-1", userId: "user-1", book_id: 7n, label: "Mom", status: "draft" };

const PAGE = {
  id: 42n,
  text_overlay: { elements: [{ text: "Once upon a time" }] },
  text_content: null,
};

/**
 * The route only ever touches `request.formData()`, so the form is handed over
 * directly. Encoding it into a real multipart body would route through undici,
 * which does not recognize jsdom Blobs and silently stringifies them — that
 * truncation is a harness artifact, not behavior worth asserting.
 */
function buildRequest(overrides: Partial<Record<string, string | Blob>> = {}) {
  const form = new FormData();
  form.set("trackId", "track-1");
  form.set("pageNumber", "3");
  form.set("durationMs", "4000");
  form.set("file", new Blob([new Uint8Array([1, 2, 3])], { type: "audio/mp4" }), "page3.m4a");

  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) form.delete(key);
    else form.set(key, value);
  }

  const request = new NextRequest("http://localhost/api/narrations/pages", { method: "POST" });
  vi.spyOn(request, "formData").mockResolvedValue(form);
  return request;
}

describe("POST /api/narrations/pages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});

    mockGetAuthenticatedUser.mockResolvedValue({ user: { id: "user-1" } });
    mockPrisma.user_narration_track.findUnique.mockResolvedValue(TRACK);
    mockPrisma.pages.findFirst.mockResolvedValue(PAGE);
    mockPrisma.user_narration_page.findUnique.mockResolvedValue(null);
    mockAlignRecording.mockResolvedValue({
      status: "aligned",
      loss: 0.1,
      timestamps: [
        { word: "Once", start: 0, end: 1 },
        { word: "upon", start: 1, end: 2 },
        { word: "a", start: 2, end: 3 },
        { word: "time", start: 3, end: 4 },
      ],
    });
    mockUploadRecording.mockResolvedValue("https://cdn.test/audio.m4a");
    mockPrisma.user_narration_page.upsert.mockImplementation(({ create }) => ({
      ...create,
      page: { page_number: 3 },
    }));
  });

  it("rejects an unauthenticated caller", async () => {
    const { NextResponse } = await import("next/server");
    mockGetAuthenticatedUser.mockResolvedValue({
      error: NextResponse.json({ error: { code: "unauthorized" } }, { status: 401 }),
    });

    const response = await POST(buildRequest());

    expect(response.status).toBe(401);
    expect(mockUploadRecording).not.toHaveBeenCalled();
  });

  it("rejects a track owned by another account", async () => {
    mockPrisma.user_narration_track.findUnique.mockResolvedValue({ ...TRACK, userId: "someone-else" });

    const response = await POST(buildRequest());

    expect(response.status).toBe(403);
    expect(mockUploadRecording).not.toHaveBeenCalled();
  });

  it("rejects an unsupported audio type", async () => {
    const response = await POST(
      buildRequest({ file: new Blob(["nope"], { type: "video/mp4" }) })
    );

    expect(response.status).toBe(415);
  });

  it("rejects an oversized recording", async () => {
    const big = new Blob([new Uint8Array(11 * 1024 * 1024)], { type: "audio/mp4" });

    const response = await POST(buildRequest({ file: big }));

    expect(response.status).toBe(413);
  });

  it("rejects a recording longer than five minutes", async () => {
    const response = await POST(buildRequest({ durationMs: String(6 * 60 * 1000) }));

    expect(response.status).toBe(413);
  });

  it("404s when the page does not exist in this book", async () => {
    mockPrisma.pages.findFirst.mockResolvedValue(null);

    const response = await POST(buildRequest());

    expect(response.status).toBe(404);
  });

  it("422s on an image-only page with no text to align against", async () => {
    mockPrisma.pages.findFirst.mockResolvedValue({ id: 42n, text_overlay: null, text_content: null });

    const response = await POST(buildRequest());

    expect(response.status).toBe(422);
    expect(mockAlignRecording).not.toHaveBeenCalled();
  });

  it("aligns against the page's own text and stores the rendered word count", async () => {
    const response = await POST(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(mockAlignRecording).toHaveBeenCalledWith(
      expect.objectContaining({
        tokens: ["Once", "upon", "a", "time"],
        durationSeconds: 4,
      })
    );

    const written = mockPrisma.user_narration_page.upsert.mock.calls[0][0].create;
    expect(written.word_count).toBe(4);
    expect(written.alignment_status).toBe("aligned");
    expect(written.audio_url).toBe("https://cdn.test/audio.m4a");
    expect(written.audio_path).toMatch(/^user-narrations\/user-1\/7\/track-1\/page_3_/);
    expect(body.page.wordTimestamps).toHaveLength(4);
    expect(body.page.pageNumber).toBe(3);
  });

  it("persists a fallback alignment rather than failing the upload", async () => {
    mockAlignRecording.mockResolvedValue({
      status: "fallback",
      timestamps: [
        { word: "Once", start: 0, end: 1 },
        { word: "upon", start: 1, end: 2 },
        { word: "a", start: 2, end: 3 },
        { word: "time", start: 3, end: 4 },
      ],
    });

    const response = await POST(buildRequest());

    expect(response.status).toBe(201);
    expect(mockPrisma.user_narration_page.upsert.mock.calls[0][0].create.alignment_status).toBe(
      "fallback"
    );
  });

  it("deletes the superseded object on a retake", async () => {
    mockPrisma.user_narration_page.findUnique.mockResolvedValue({ audio_path: "old/path.m4a" });

    await POST(buildRequest());

    expect(mockRemoveRecordings).toHaveBeenCalledWith(["old/path.m4a"]);
  });

  it("does not delete anything on a first recording", async () => {
    await POST(buildRequest());

    expect(mockRemoveRecordings).not.toHaveBeenCalled();
  });

  it("500s without leaking the error when persistence fails", async () => {
    mockPrisma.user_narration_page.upsert.mockRejectedValue(new Error("db exploded"));

    const response = await POST(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(JSON.stringify(body)).not.toContain("db exploded");
  });
});
