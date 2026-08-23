import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const { mockRequireAdmin, mockPrisma, mockAlignRecording, mockUploadRecording, mockRemoveRecordings } =
  vi.hoisted(() => ({
    mockRequireAdmin: vi.fn(),
    mockPrisma: {
      pages: { findFirst: vi.fn(), update: vi.fn() },
      page_audio_assignments: { deleteMany: vi.fn(), create: vi.fn() },
      page_overlay_narrations: { deleteMany: vi.fn() },
      $transaction: vi.fn(),
    },
    mockAlignRecording: vi.fn(),
    mockUploadRecording: vi.fn(),
    mockRemoveRecordings: vi.fn(),
  }));

vi.mock("@/lib/admin-auth", () => ({ requireAdmin: mockRequireAdmin }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/narration/alignRecording", () => ({ alignRecording: mockAlignRecording }));
vi.mock("@/lib/narration/storage", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/narration/storage")>()),
  uploadRecording: mockUploadRecording,
  removeRecordings: mockRemoveRecordings,
}));

import { POST } from "./route";

const context = { params: Promise.resolve({ id: "7", pageNumber: "3" }) };

function request(type = "audio/webm") {
  const form = new FormData();
  form.set("file", new Blob([new Uint8Array([1, 2, 3])], { type }), "page.webm");
  form.set("durationMs", "4000");
  const value = new NextRequest("http://localhost/api", { method: "POST" });
  vi.spyOn(value, "formData").mockResolvedValue(form);
  return value;
}

describe("recorded narration route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockRequireAdmin.mockResolvedValue({ user: { id: "admin-1" } });
    mockPrisma.pages.findFirst.mockResolvedValue({
      id: 42n,
      text_overlay: { elements: [{ text: "Once upon a time" }] },
      text_content: null,
    });
    mockAlignRecording.mockResolvedValue({
      status: "aligned",
      timestamps: [
        { word: "Once", start: 0, end: 1 },
        { word: "upon", start: 1, end: 2 },
        { word: "a", start: 2, end: 3 },
        { word: "time", start: 3, end: 4 },
      ],
    });
    mockUploadRecording.mockResolvedValue("https://cdn.test/page.webm");
    mockPrisma.pages.update.mockResolvedValue({});
    mockPrisma.page_audio_assignments.deleteMany.mockResolvedValue({ count: 1 });
    mockPrisma.page_audio_assignments.create.mockResolvedValue({});
    mockPrisma.page_overlay_narrations.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.$transaction.mockImplementation((operations) => Promise.all(operations));
  });

  it("records a browser WebM, aligns it, and makes it the page narration", async () => {
    const response = await POST(request(), context);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockAlignRecording).toHaveBeenCalledWith(
      expect.objectContaining({ tokens: ["Once", "upon", "a", "time"], durationSeconds: 4 })
    );
    expect(mockPrisma.pages.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 42n },
        data: expect.objectContaining({
          narration_url: "https://cdn.test/page.webm",
          narration_timestamps: expect.arrayContaining([expect.objectContaining({ word: "Once" })]),
        }),
      })
    );
    expect(mockPrisma.page_audio_assignments.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ audio_type: "narration", scope: "single" }),
      })
    );
    expect(mockPrisma.page_overlay_narrations.deleteMany).toHaveBeenCalledWith({
      where: { page_id: 42n },
    });
    expect(body.alignmentStatus).toBe("aligned");
  });

  it("requires an admin session", async () => {
    mockRequireAdmin.mockResolvedValue(
      NextResponse.json({ error: "Authentication required." }, { status: 401 })
    );

    const response = await POST(request(), context);

    expect(response.status).toBe(401);
    expect(mockPrisma.pages.findFirst).not.toHaveBeenCalled();
  });

  it("rejects pages without narration text before uploading", async () => {
    mockPrisma.pages.findFirst.mockResolvedValue({
      id: 42n,
      text_overlay: null,
      text_content: "",
    });

    const response = await POST(request(), context);

    expect(response.status).toBe(422);
    expect(mockUploadRecording).not.toHaveBeenCalled();
  });
});
