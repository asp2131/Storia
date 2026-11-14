import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: { $executeRaw: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { POST } from "@/app/api/analytics/guest-likes/route";

function post(body: unknown) {
  return POST(
    new NextRequest("http://localhost/api/analytics/guest-likes", {
      method: "POST",
      body: typeof body === "string" ? body : JSON.stringify(body),
    })
  );
}

describe("/api/analytics/guest-likes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.$executeRaw.mockResolvedValue(1);
  });

  it("counts one like per request without any authentication", async () => {
    const response = await post({ bookId: "77", pageNumber: 4, likes: 5000 });
    expect(response.status).toBe(201);
    // Tagged template call: values follow the strings array.
    const values = mockPrisma.$executeRaw.mock.calls[0].slice(1);
    expect(values).toEqual([1, 77n, 4]);
  });

  it.each([
    [{ pageNumber: 1, likes: 1 }, "bookId"],
    [{ bookId: "abc", pageNumber: 1, likes: 1 }, "bookId"],
    [{ bookId: 77, pageNumber: 0, likes: 1 }, "pageNumber"],
    [{ bookId: 77, pageNumber: 1, likes: -3 }, "likes"],
    [{ bookId: 77, pageNumber: 1, likes: "1; DROP TABLE books" }, "likes"],
    ["not json", "body"],
  ])("rejects %j", async (body, field) => {
    const response = await post(body);
    expect(response.status).toBe(400);
    expect((await response.json()).error.details.field).toBe(field);
    expect(mockPrisma.$executeRaw).not.toHaveBeenCalled();
  });

  it("returns 404 when the page is not part of a published book", async () => {
    mockPrisma.$executeRaw.mockResolvedValue(0);
    expect((await post({ bookId: 77, pageNumber: 999, likes: 1 })).status).toBe(404);
  });
});
