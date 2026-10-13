import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const { prisma, requireStudio, requireBookAccess } = vi.hoisted(() => ({
  prisma: { books: { create: vi.fn(), update: vi.fn(), findUnique: vi.fn() } },
  requireStudio: vi.fn(),
  requireBookAccess: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("@/lib/admin-auth", () => ({ requireStudio, requireBookAccess }));

import { POST } from "./route";
import { PATCH } from "./[id]/route";

function setRole(role: "admin" | "author") {
  const user = { id: `${role}_1`, role };
  requireStudio.mockResolvedValue({ user });
  requireBookAccess.mockResolvedValue({ user, isOwner: role === "author" });
}

function request(method: string, body: unknown) {
  return new NextRequest("http://localhost/api/admin/books/42", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const params = Promise.resolve({ id: "42" });
const create = (body: Record<string, unknown>) => POST(request("POST", { title: "Book", author: "Creator", ...body }));
const patch = (body: Record<string, unknown>) => PATCH(request("PATCH", body), { params });

beforeEach(() => {
  vi.resetAllMocks();
  setRole("admin");
});

describe.each([
  { name: "create", write: create },
  { name: "edit", write: patch },
])("artwork provenance $name boundary", ({ write }) => {
  it("rejects an author's classification before any book mutation", async () => {
    setRole("author");
    const response = await write({ artworkProvenance: "human_created" });
    expect(response.status).toBe(403);
    expect(prisma.books.create).not.toHaveBeenCalled();
    expect(prisma.books.update).not.toHaveBeenCalled();
  });

  it.each([null, "human", true])("rejects invalid admin classification %j", async (artworkProvenance) => {
    const response = await write({ artworkProvenance });
    expect(response.status).toBe(400);
    expect(prisma.books.create).not.toHaveBeenCalled();
    expect(prisma.books.update).not.toHaveBeenCalled();
  });

  it("does not bypass the existing authentication gate", async () => {
    requireStudio.mockResolvedValue(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
    requireBookAccess.mockResolvedValue(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
    const response = await write({ artworkProvenance: "human_created" });
    expect(response.status).toBe(401);
    expect(prisma.books.create).not.toHaveBeenCalled();
    expect(prisma.books.update).not.toHaveBeenCalled();
  });
});

it("preserves the stored classification when an author edits other metadata", async () => {
  setRole("author");
  let storedBook = {
    id: 42n,
    title: "Original title",
    author: "Creator",
    artwork_provenance: "human_created",
    review_status: "draft",
    updated_at: new Date("2026-09-08T00:00:00Z"),
  };
  prisma.books.findUnique.mockImplementation(async () => storedBook);
  prisma.books.update.mockImplementation(async ({ data }) => {
    storedBook = { ...storedBook, ...data };
    return storedBook;
  });

  const response = await patch({ title: "Edited title" });
  expect(response.status).toBe(200);
  const { book } = await response.json();
  expect(book.title).toBe("Edited title");
  expect(book.artworkProvenance).toBe("human_created");
});
