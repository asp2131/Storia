import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { mockValidateChildAccess, mockPrisma } = vi.hoisted(() => ({
  mockValidateChildAccess: vi.fn(),
  mockPrisma: {
    book_question: {
      findMany: vi.fn(),
    },
    question_attempt: {
      createMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/child-auth", () => ({
  validateChildAccess: mockValidateChildAccess,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

import { POST } from "@/app/api/comprehension/route";

describe("/api/comprehension", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    mockValidateChildAccess.mockResolvedValue({
      user: { id: "user-1" },
      childProfile: { id: "child-1" },
    });
  });

  it("rejects invalid answer payloads", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/comprehension", {
        method: "POST",
        body: JSON.stringify({
          childProfileId: "child-1",
          bookId: "101",
          answers: [{ questionId: "", selectedAnswer: "A" }],
        }),
      })
    );

    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      error: {
        code: "invalid_request",
        message: "answers must be a non-empty array of { questionId, selectedAnswer }",
        details: { field: "answers" },
      },
    });
    expect(mockValidateChildAccess).not.toHaveBeenCalled();
    expect(mockPrisma.question_attempt.createMany).not.toHaveBeenCalled();
  });

  it("rejects question ids that do not belong to the submitted book", async () => {
    mockPrisma.book_question.findMany.mockResolvedValue([
      { id: "q_1", correctAnswer: "A" },
    ]);

    const response = await POST(
      new NextRequest("http://localhost/api/comprehension", {
        method: "POST",
        body: JSON.stringify({
          childProfileId: "child-1",
          bookId: "101",
          answers: [
            { questionId: "q_1", selectedAnswer: "A" },
            { questionId: "q_missing", selectedAnswer: "B" },
          ],
        }),
      })
    );

    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      error: {
        code: "invalid_request",
        message: "One or more questionIds are invalid for this book",
        details: {
          field: "answers",
          questionIds: ["q_missing"],
        },
      },
    });
    expect(mockPrisma.question_attempt.createMany).not.toHaveBeenCalled();
  });

  it("scores answers, persists attempts, and returns answerResults for mobile analytics", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-15T10:20:00.000Z"));

    mockPrisma.book_question.findMany.mockResolvedValue([
      { id: "q_1", correctAnswer: "A" },
      { id: "q_2", correctAnswer: "C" },
    ]);
    mockPrisma.question_attempt.createMany.mockResolvedValue({ count: 2 });

    const response = await POST(
      new NextRequest("http://localhost/api/comprehension", {
        method: "POST",
        body: JSON.stringify({
          childProfileId: "child-1",
          bookId: "101",
          readingSessionId: "rs_123",
          answers: [
            { questionId: "q_1", selectedAnswer: "A" },
            { questionId: "q_2", selectedAnswer: "B" },
          ],
        }),
      })
    );

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockValidateChildAccess).toHaveBeenCalledWith("child-1");
    expect(mockPrisma.book_question.findMany).toHaveBeenCalledWith({
      where: {
        id: { in: ["q_1", "q_2"] },
        bookId: 101n,
      },
      select: {
        id: true,
        correctAnswer: true,
      },
    });
    expect(mockPrisma.question_attempt.createMany).toHaveBeenCalledWith({
      data: [
        {
          userId: "user-1",
          childProfileId: "child-1",
          bookId: 101n,
          questionId: "q_1",
          readingSessionId: "rs_123",
          selectedAnswer: "A",
          isCorrect: true,
        },
        {
          userId: "user-1",
          childProfileId: "child-1",
          bookId: 101n,
          questionId: "q_2",
          readingSessionId: "rs_123",
          selectedAnswer: "B",
          isCorrect: false,
        },
      ],
    });
    expect(body).toEqual({
      result: {
        bookId: "101",
        childProfileId: "child-1",
        totalQuestions: 2,
        correctCount: 1,
        scorePercent: 50,
        submittedAt: "2026-04-15T10:20:00.000Z",
      },
      answerResults: [
        { questionId: "q_1", selectedAnswer: "A", isCorrect: true },
        { questionId: "q_2", selectedAnswer: "B", isCorrect: false },
      ],
    });
  });

  it("rejects duplicate question ids", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/comprehension", {
        method: "POST",
        body: JSON.stringify({
          childProfileId: "child-1",
          bookId: "101",
          answers: [
            { questionId: "q_1", selectedAnswer: "A" },
            { questionId: "q_1", selectedAnswer: "B" },
          ],
        }),
      })
    );

    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      error: {
        code: "invalid_request",
        message: "answers must not contain duplicate questionId values",
        details: { field: "answers" },
      },
    });
    expect(mockValidateChildAccess).not.toHaveBeenCalled();
  });
});
