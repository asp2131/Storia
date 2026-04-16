import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    book_question: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

import { GET } from "@/app/api/books/[id]/questions/route";

describe("/api/books/[id]/questions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns mobile-friendly questions without exposing correct answers", async () => {
    mockPrisma.book_question.findMany.mockResolvedValue([
      {
        id: "q_1",
        bookId: 101n,
        questionText: "Why did the little prince leave his planet?",
        questionType: "multiple_choice",
        sortOrder: 1,
        correctAnswer: "A",
        options: [
          { id: "q_1_a", optionKey: "A", optionText: "To find new friends", sortOrder: 0 },
          { id: "q_1_b", optionKey: "B", optionText: "To buy a spaceship", sortOrder: 1 },
        ],
      },
    ]);

    const response = await GET(new NextRequest("http://localhost/api/books/101/questions"), {
      params: Promise.resolve({ id: "101" }),
    });

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockPrisma.book_question.findMany).toHaveBeenCalledWith({
      where: { bookId: 101n },
      orderBy: { sortOrder: "asc" },
      include: {
        options: {
          orderBy: { sortOrder: "asc" },
          select: {
            id: true,
            optionKey: true,
            optionText: true,
            sortOrder: true,
          },
        },
      },
    });
    expect(body).toEqual({
      questions: [
        {
          id: "q_1",
          bookId: "101",
          questionText: "Why did the little prince leave his planet?",
          questionType: "multiple_choice",
          sortOrder: 1,
          options: [
            {
              id: "q_1_a",
              optionKey: "A",
              optionText: "To find new friends",
              sortOrder: 0,
            },
            {
              id: "q_1_b",
              optionKey: "B",
              optionText: "To buy a spaceship",
              sortOrder: 1,
            },
          ],
        },
      ],
    });
    expect(JSON.stringify(body)).not.toContain("correctAnswer");
  });

  it("rejects non-numeric book ids", async () => {
    const response = await GET(new NextRequest("http://localhost/api/books/not-a-number/questions"), {
      params: Promise.resolve({ id: "not-a-number" }),
    });

    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      error: {
        code: "invalid_request",
        message: "bookId must be a positive integer",
        details: { field: "bookId" },
      },
    });
    expect(mockPrisma.book_question.findMany).not.toHaveBeenCalled();
  });
});
