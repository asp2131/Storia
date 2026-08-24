import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { DEFAULT_BOOK_TEXT_STYLE } from "@/types/text-overlay";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    books: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
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

import { GET, PATCH } from "./route";

const params = Promise.resolve({ id: "42" });

const storedStyle = {
  fontFamily: "Lora",
  fontSize: 6.5,
  fontWeight: 600,
  color: "#123456",
  textAlign: "center",
};

function makeBook(overrides: Record<string, unknown> = {}) {
  return {
    id: 42n,
    title: "Test",
    author: "Author",
    processing_status: "ready",
    updated_at: new Date("2026-07-21T00:00:00Z"),
    cover_url: null,
    description: null,
    is_published: false,
    default_text_style: null,
    ...overrides,
  };
}

function patchRequest(body: unknown) {
  return new NextRequest("http://localhost/api", {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("admin book route — defaultTextStyle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET returns DEFAULT_BOOK_TEXT_STYLE when the column is null", async () => {
    mockPrisma.books.findUnique.mockResolvedValue(makeBook());

    const response = await GET(new NextRequest("http://localhost/api"), { params });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.book.defaultTextStyle).toEqual(DEFAULT_BOOK_TEXT_STYLE);
  });

  it("GET coerces a malformed stored style to defaults", async () => {
    mockPrisma.books.findUnique.mockResolvedValue(
      makeBook({ default_text_style: { fontFamily: "Comic Sans" } })
    );

    const response = await GET(new NextRequest("http://localhost/api"), { params });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.book.defaultTextStyle).toEqual(DEFAULT_BOOK_TEXT_STYLE);
  });

  it("GET returns the stored style when valid", async () => {
    mockPrisma.books.findUnique.mockResolvedValue(
      makeBook({ default_text_style: storedStyle })
    );

    const response = await GET(new NextRequest("http://localhost/api"), { params });
    const payload = await response.json();

    expect(payload.book.defaultTextStyle).toEqual(storedStyle);
  });

  it("PATCH rejects an invalid defaultTextStyle with 400", async () => {
    const response = await PATCH(
      patchRequest({ defaultTextStyle: { ...storedStyle, fontFamily: "Comic Sans" } }),
      { params }
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toBe("Invalid defaultTextStyle");
    expect(payload.details).toMatch(/fontFamily/);
    expect(mockPrisma.books.update).not.toHaveBeenCalled();
  });

  it("PATCH persists a valid style and returns it", async () => {
    mockPrisma.books.update.mockResolvedValue(
      makeBook({ default_text_style: storedStyle })
    );

    const response = await PATCH(patchRequest({ defaultTextStyle: storedStyle }), { params });
    const payload = await response.json();

    expect(response.status).toBe(200);
    const updateData = mockPrisma.books.update.mock.calls[0][0].data;
    expect(updateData.default_text_style).toEqual(storedStyle);
    expect(payload.book.defaultTextStyle).toEqual(storedStyle);
  });
});
