import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { TEXT_OVERLAY_VERSION } from "@/types/text-overlay";
import type { BookTextStyle, TextElement } from "@/types/text-overlay";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    books: {
      findUnique: vi.fn(),
    },
    pages: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(async (promises: Promise<unknown>[]) =>
      Promise.all(promises)
    ),
  },
}));

// The studio gates are exercised in admin-auth.test.ts; here they stand in as
// an admin, who passes every ownership check.
vi.mock("@/lib/admin-auth", () => {
  const user = {
    id: "admin_1",
    name: "Admin User",
    email: "admin@example.com",
    role: "admin",
  };
  return {
    STUDIO_ROLES: ["admin", "author"],
    requireRole: vi.fn(async () => ({ user })),
    requireAdmin: vi.fn(async () => ({ user })),
    requireStudio: vi.fn(async () => ({ user })),
    requireBookAccess: vi.fn(async () => ({ user, isOwner: false })),
    assertBookAccess: vi.fn(async () => null),
    assertPageAccess: vi.fn(async () => null),
  };
});

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

import { POST } from "./route";

const params = Promise.resolve({ id: "42" });

const storedStyle: BookTextStyle = {
  fontFamily: "Lora",
  fontSize: 6.5,
  fontWeight: 600,
  color: "#123456",
  textAlign: "center",
  voiceId: "voice-1",
  voiceName: "Narrator",
};

function makeElement(id: string): TextElement {
  return {
    id,
    text: `text-${id}`,
    x: 20,
    y: 30,
    width: 40,
    fontFamily: "Inter",
    fontSize: 4,
    fontWeight: 400,
    color: "#000000",
    textAlign: "left",
    rotation: 15,
    shadow: { color: "#000", offsetX: 1, offsetY: 1, blur: 1 },
  };
}

function makeOverlay(...ids: string[]) {
  return { version: TEXT_OVERLAY_VERSION, elements: ids.map(makeElement) };
}

describe("apply-text-style route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.pages.update.mockImplementation((args) =>
      Promise.resolve({ id: args.where.id })
    );
  });

  it("returns 404 when the book does not exist", async () => {
    mockPrisma.books.findUnique.mockResolvedValue(null);

    const response = await POST(new NextRequest("http://localhost/api", { method: "POST" }), { params });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Book not found." });
    expect(mockPrisma.pages.findMany).not.toHaveBeenCalled();
  });

  it("restyles only pages with overlays, clears composited fields, returns counts", async () => {
    mockPrisma.books.findUnique.mockResolvedValue({
      default_text_style: storedStyle,
    });
    mockPrisma.pages.findMany.mockResolvedValue([
      { id: 1n, text_overlay: makeOverlay("a", "b") },
      { id: 2n, text_overlay: null },
      { id: 3n, text_overlay: Prisma.JsonNull },
      { id: 4n, text_overlay: makeOverlay("c") },
    ]);

    const response = await POST(new NextRequest("http://localhost/api", { method: "POST" }), { params });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      pagesUpdated: 2,
      elementsRestyled: 3,
      pagesSkipped: 0,
    });

    expect(mockPrisma.pages.update).toHaveBeenCalledTimes(2);
    const firstUpdate = mockPrisma.pages.update.mock.calls[0][0];
    expect(firstUpdate.where).toEqual({ id: 1n });
    expect(firstUpdate.data.composited_image_url).toBeNull();
    expect(firstUpdate.data.composited_image_path).toBeNull();
    expect(firstUpdate.data.composited_at).toBeNull();
    expect(firstUpdate.data.composited_by).toBeNull();
    expect(firstUpdate.data.updated_at).toBeInstanceOf(Date);

    const overlay = firstUpdate.data.text_overlay;
    expect(overlay.elements[0]).toMatchObject({
      id: "a",
      text: "text-a",
      x: 20,
      y: 30,
      width: 40,
      rotation: 15,
      fontFamily: "Lora",
      fontSize: 6.5,
      fontWeight: 600,
      color: "#123456",
      textAlign: "center",
      voiceId: "voice-1",
      voiceName: "Narrator",
    });
    // Style omits shadow → element shadow removed.
    expect(overlay.elements[0]).not.toHaveProperty("shadow");
    // text_content is untouched by the bulk apply.
    expect(firstUpdate.data).not.toHaveProperty("text_content");

    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it("falls back to DEFAULT_BOOK_TEXT_STYLE when the column is null", async () => {
    mockPrisma.books.findUnique.mockResolvedValue({ default_text_style: null });
    mockPrisma.pages.findMany.mockResolvedValue([
      { id: 1n, text_overlay: makeOverlay("a") },
    ]);

    const response = await POST(new NextRequest("http://localhost/api", { method: "POST" }), { params });
    expect(response.status).toBe(200);

    const overlay = mockPrisma.pages.update.mock.calls[0][0].data.text_overlay;
    expect(overlay.elements[0]).toMatchObject({
      fontFamily: "Inter",
      fontSize: 5,
      fontWeight: 400,
      color: "#000000",
      textAlign: "left",
    });
    expect(overlay.elements[0]).not.toHaveProperty("voiceId");
  });

  it("falls back to defaults when the stored style is malformed", async () => {
    mockPrisma.books.findUnique.mockResolvedValue({
      default_text_style: { fontFamily: "Comic Sans" },
    });
    mockPrisma.pages.findMany.mockResolvedValue([
      { id: 1n, text_overlay: makeOverlay("a") },
    ]);

    const response = await POST(new NextRequest("http://localhost/api", { method: "POST" }), { params });
    expect(response.status).toBe(200);
    expect(
      mockPrisma.pages.update.mock.calls[0][0].data.text_overlay.elements[0]
        .fontFamily
    ).toBe("Inter");
  });

  it("skips malformed page overlays and counts them", async () => {
    mockPrisma.books.findUnique.mockResolvedValue({
      default_text_style: storedStyle,
    });
    mockPrisma.pages.findMany.mockResolvedValue([
      { id: 1n, text_overlay: { version: 999, elements: [] } },
      { id: 2n, text_overlay: makeOverlay("a") },
    ]);

    const response = await POST(new NextRequest("http://localhost/api", { method: "POST" }), { params });
    const payload = await response.json();

    expect(payload).toEqual({
      pagesUpdated: 1,
      elementsRestyled: 1,
      pagesSkipped: 1,
    });
    expect(mockPrisma.pages.update).toHaveBeenCalledTimes(1);
  });

  it("returns zeros and skips the transaction when no pages have overlays", async () => {
    mockPrisma.books.findUnique.mockResolvedValue({
      default_text_style: storedStyle,
    });
    mockPrisma.pages.findMany.mockResolvedValue([
      { id: 1n, text_overlay: null },
    ]);

    const response = await POST(new NextRequest("http://localhost/api", { method: "POST" }), { params });
    const payload = await response.json();

    expect(payload).toEqual({
      pagesUpdated: 0,
      elementsRestyled: 0,
      pagesSkipped: 0,
    });
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("returns 500 when the transaction fails (all-or-nothing)", async () => {
    mockPrisma.books.findUnique.mockResolvedValue({
      default_text_style: storedStyle,
    });
    mockPrisma.pages.findMany.mockResolvedValue([
      { id: 1n, text_overlay: makeOverlay("a") },
      { id: 2n, text_overlay: makeOverlay("b") },
    ]);
    mockPrisma.$transaction.mockRejectedValueOnce(new Error("db exploded"));

    const response = await POST(new NextRequest("http://localhost/api", { method: "POST" }), { params });

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: "Failed to apply text style.",
    });
    // Array-style $transaction: a single atomic call, no per-page partial commits.
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
  });
});
