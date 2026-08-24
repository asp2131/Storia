import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const { mockPrisma, mockRequireAdmin, mockRequireBookAccess } = vi.hoisted(() => ({
  mockPrisma: {
    books: { findUnique: vi.fn(), update: vi.fn() },
  },
  mockRequireAdmin: vi.fn(),
  mockRequireBookAccess: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/admin-auth", () => ({
  requireAdmin: mockRequireAdmin,
  requireBookAccess: mockRequireBookAccess,
}));

import { POST } from "@/app/api/admin/books/[id]/review/route";

const admin = { user: { id: "a1", name: "A", email: "a@x.com", role: "admin" } };
const author = {
  user: { id: "u1", name: "U", email: "u@x.com", role: "author" },
  isOwner: true,
};

const forbidden = () =>
  NextResponse.json({ error: "You do not have access." }, { status: 403 });

const post = (action: string, note?: string) =>
  POST(
    new NextRequest("http://localhost/api/admin/books/5/review", {
      method: "POST",
      body: JSON.stringify({ action, note }),
      headers: { "Content-Type": "application/json" },
    }),
    { params: Promise.resolve({ id: "5" }) }
  );

const readyBook = {
  title: "The Quiet Fox",
  author: "R. Vale",
  review_status: "draft",
  total_pages: 12,
};

describe("POST /api/admin/books/[id]/review", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdmin.mockResolvedValue(admin);
    mockRequireBookAccess.mockResolvedValue(author);
    mockPrisma.books.findUnique.mockResolvedValue(readyBook);
    mockPrisma.books.update.mockImplementation(async ({ data }) => ({
      id: 5n,
      review_status: data.review_status ?? "draft",
      review_note: data.review_note ?? null,
      is_published: data.is_published ?? false,
      submitted_at: data.submitted_at ?? null,
      reviewed_at: data.reviewed_at ?? null,
    }));
  });

  it("lets an author submit a complete book", async () => {
    const response = await post("submit");

    expect(response.status).toBe(200);
    expect(mockPrisma.books.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ review_status: "submitted" }),
      })
    );
    // Submitting must never publish.
    expect(mockPrisma.books.update.mock.calls[0][0].data).not.toHaveProperty(
      "is_published"
    );
  });

  it("blocks submission of a placeholder draft", async () => {
    mockPrisma.books.findUnique.mockResolvedValue({
      title: "Untitled Book",
      author: "Unknown",
      review_status: "draft",
      total_pages: 0,
    });

    const response = await post("submit");

    expect(response.status).toBe(400);
    expect((await response.json()).problems).toHaveLength(3);
    expect(mockPrisma.books.update).not.toHaveBeenCalled();
  });

  it("routes approve through the admin gate, not the ownership gate", async () => {
    mockPrisma.books.findUnique.mockResolvedValue({
      ...readyBook,
      review_status: "submitted",
    });

    const response = await post("approve");

    expect(mockRequireAdmin).toHaveBeenCalledTimes(1);
    expect(mockRequireBookAccess).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
    expect(mockPrisma.books.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          review_status: "approved",
          is_published: true,
        }),
      })
    );
  });

  it("refuses to publish for a non-admin", async () => {
    mockRequireAdmin.mockResolvedValue(forbidden());

    const response = await post("approve");

    expect(response.status).toBe(403);
    expect(mockPrisma.books.update).not.toHaveBeenCalled();
  });

  it("requires a reason to reject", async () => {
    mockPrisma.books.findUnique.mockResolvedValue({
      ...readyBook,
      review_status: "submitted",
    });

    expect((await post("reject")).status).toBe(400);
    expect(mockPrisma.books.update).not.toHaveBeenCalled();

    const ok = await post("reject", "Please add page numbers.");
    expect(ok.status).toBe(200);
    expect(mockPrisma.books.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          review_status: "rejected",
          is_published: false,
          review_note: "Please add page numbers.",
        }),
      })
    );
  });

  it("rejects an unknown action before touching the database", async () => {
    const response = await post("publish-now");

    expect(response.status).toBe(400);
    expect(mockRequireAdmin).not.toHaveBeenCalled();
    expect(mockRequireBookAccess).not.toHaveBeenCalled();
  });
});
