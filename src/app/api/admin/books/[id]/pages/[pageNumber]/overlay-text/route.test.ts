import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    pages: {
      findUnique: vi.fn(),
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

const params = Promise.resolve({ id: "42", pageNumber: "3" });

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api", {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("overlay text route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns persisted overlay text entries", async () => {
    mockPrisma.pages.findUnique.mockResolvedValue({ id: 7n });
    mockPrisma.page_overlay_text_entries.findMany.mockResolvedValue([
      {
        id: 9n,
        text_content: "Open",
        include_in_narration: true,
        sort_order: 0,
        bbox: null,
        confidence: null,
        source: "ocr",
      },
    ]);

    const response = await GET(new NextRequest("http://localhost/api"), { params });
    const payload = await response.json();

    expect(payload.entries).toEqual([
      {
        id: "9",
        text: "Open",
        includeInNarration: true,
        sortOrder: 0,
        bbox: null,
        confidence: null,
        source: "ocr",
      },
    ]);
  });

  it("replaces entries and preserves include/exclude state", async () => {
    mockPrisma.pages.upsert.mockResolvedValue({ id: 7n });
    mockPrisma.page_overlay_text_entries.findMany.mockResolvedValue([
      {
        id: 10n,
        text_content: "Sign",
        include_in_narration: false,
        sort_order: 0,
        bbox: null,
        confidence: null,
        source: "ocr",
      },
    ]);

    const response = await PATCH(
      makeRequest({
        entries: [
          { id: "old", text: "  Sign ", includeInNarration: false, sortOrder: 2 },
          { text: "", includeInNarration: true, sortOrder: 1 },
        ],
      }),
      { params }
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(mockPrisma.page_overlay_text_entries.deleteMany).toHaveBeenCalledWith({
      where: { page_id: 7n },
    });
    expect(mockPrisma.page_overlay_text_entries.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          page_id: 7n,
          text_content: "Sign",
          include_in_narration: false,
          sort_order: 0,
        }),
      ],
    });
    expect(payload.entries[0]).toMatchObject({
      id: "10",
      text: "Sign",
      includeInNarration: false,
    });
  });
});
