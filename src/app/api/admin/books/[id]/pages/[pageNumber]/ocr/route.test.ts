import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    pages: {
      upsert: vi.fn(),
    },
    page_overlay_text_entries: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    $transaction: vi.fn(async (callback) => callback(mockPrisma)),
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

import { POST } from "./route";

const params = Promise.resolve({ id: "42", pageNumber: "3" });

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("ocr route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("REPLICATE_API_TOKEN", "test-token");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns 400 for invalid book id", async () => {
    const response = await POST(
      makeRequest({ imageUrl: "http://example.com/img.jpg" }),
      { params: Promise.resolve({ id: "abc", pageNumber: "1" }) }
    );
    expect(response.status).toBe(400);
    const payload = await response.json();
    expect(payload.error).toContain("Invalid");
  });

  it("returns 400 for missing imageUrl", async () => {
    const response = await POST(makeRequest({}), { params });
    expect(response.status).toBe(400);
    const payload = await response.json();
    expect(payload.error).toContain("imageUrl");
  });

  it("creates overlay entries from detected text", async () => {
    mockPrisma.pages.upsert.mockResolvedValue({ id: 7n });
    mockPrisma.page_overlay_text_entries.findMany.mockResolvedValue([
      {
        id: 10n,
        text_content: "Hello World",
        include_in_narration: true,
        sort_order: 0,
        bbox: null,
        confidence: null,
        source: "ocr",
      },
    ]);

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          status: "succeeded",
          output: 'The text reads: "Hello World"',
        }),
        { status: 200 }
      )
    );

    const response = await POST(
      makeRequest({ imageUrl: "http://example.com/img.jpg" }),
      { params }
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.detectedText).toEqual(["Hello World"]);
    expect(payload.entries).toHaveLength(1);
    expect(payload.entries[0]).toMatchObject({
      text: "Hello World",
      includeInNarration: true,
    });

    expect(mockPrisma.page_overlay_text_entries.deleteMany).toHaveBeenCalledWith({
      where: { page_id: 7n, source: "ocr" },
    });
    expect(mockPrisma.page_overlay_text_entries.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          page_id: 7n,
          text_content: "Hello World",
          include_in_narration: true,
          sort_order: 0,
          source: "ocr",
        }),
      ],
    });

    fetchSpy.mockRestore();
  });

  it("handles empty detected text gracefully", async () => {
    mockPrisma.pages.upsert.mockResolvedValue({ id: 7n });
    mockPrisma.page_overlay_text_entries.findMany.mockResolvedValue([]);

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          status: "succeeded",
          output: "There is no readable text in this image.",
        }),
        { status: 200 }
      )
    );

    const response = await POST(
      makeRequest({ imageUrl: "http://example.com/empty.jpg" }),
      { params }
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.detectedText).toEqual([]);
    expect(payload.entries).toEqual([]);
    expect(mockPrisma.page_overlay_text_entries.createMany).not.toHaveBeenCalled();

    fetchSpy.mockRestore();
  });

  it("returns 502 when replicate request fails", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "bad request" }), { status: 400 })
    );

    const response = await POST(
      makeRequest({ imageUrl: "http://example.com/img.jpg" }),
      { params }
    );
    const payload = await response.json();

    expect(response.status).toBe(502);
    expect(payload.error).toBeTruthy();
    expect(payload.entries).toEqual([]);

    fetchSpy.mockRestore();
  });

  it("polls replicate until succeeded when initial status is not final", async () => {
    mockPrisma.pages.upsert.mockResolvedValue({ id: 7n });
    mockPrisma.page_overlay_text_entries.findMany.mockResolvedValue([
      {
        id: 11n,
        text_content: "Open",
        include_in_narration: true,
        sort_order: 0,
        bbox: null,
        confidence: null,
        source: "ocr",
      },
    ]);

    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: "processing",
            urls: { get: "http://poll.url/1" },
          }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: "succeeded",
            output: 'The text reads: "Open"',
          }),
          { status: 200 }
        )
      );

    const response = await POST(
      makeRequest({ imageUrl: "http://example.com/img.jpg" }),
      { params }
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.detectedText).toEqual(["Open"]);
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    fetchSpy.mockRestore();
  });

  it("returns 504 when replicate times out", async () => {
    const abortError = new Error("The operation was aborted");
    abortError.name = "AbortError";
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
      await new Promise((_, reject) =>
        setTimeout(() => reject(abortError), 10)
      );
      throw abortError;
    });

    const response = await POST(
      makeRequest({ imageUrl: "http://example.com/img.jpg" }),
      { params }
    );
    const payload = await response.json();

    expect(response.status).toBe(504);
    expect(payload.error).toContain("timed out");

    fetchSpy.mockRestore();
  });
});
