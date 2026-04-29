import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const { mockPrisma, mockRequireAdmin, mockTx } = vi.hoisted(() => {
  const mockTx = {
    book_question: {
      update: vi.fn(),
      findUnique: vi.fn(),
    },
    book_question_option: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
  };

  return {
    mockRequireAdmin: vi.fn(),
    mockTx,
    mockPrisma: {
      $transaction: vi.fn(),
      books: {
        findUnique: vi.fn(),
      },
      book_question: {
        findMany: vi.fn(),
        create: vi.fn(),
        findFirst: vi.fn(),
        delete: vi.fn(),
      },
    },
  };
});

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

vi.mock("@/lib/admin-auth", () => ({
  requireAdmin: mockRequireAdmin,
}));

import { GET, POST } from "@/app/api/books/[id]/questions/route";
import { PATCH, DELETE } from "@/app/api/books/[id]/questions/[questionId]/route";

const adminResult = {
  user: {
    id: "admin_1",
    name: "Admin User",
    email: "admin@example.com",
    role: "admin",
  },
};

const authResponse = (status: 401 | 403) =>
  NextResponse.json(
    { error: status === 401 ? "Authentication required." : "Admin access required." },
    { status }
  );

const makeJsonRequest = (method: string, url: string, body: unknown) =>
  new NextRequest(url, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

const createPayload = {
  questionText: "What did the fox teach?",
  questionType: "multiple_choice",
  sortOrder: 2,
  correctAnswer: "A",
  options: [
    { optionKey: "A", optionText: "To be responsible for what you tame", sortOrder: 0 },
    { optionKey: "B", optionText: "To avoid all roses", sortOrder: 1 },
  ],
};

describe("/api/books/[id]/questions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(async (callback) => callback(mockTx));
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
    expect(mockRequireAdmin).not.toHaveBeenCalled();
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

  it("returns 401 when an unauthenticated user creates a question", async () => {
    mockRequireAdmin.mockResolvedValue(authResponse(401));

    const response = await POST(
      makeJsonRequest("POST", "http://localhost/api/books/101/questions", createPayload),
      { params: Promise.resolve({ id: "101" }) }
    );

    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ error: "Authentication required." });
    expect(mockRequireAdmin).toHaveBeenCalledTimes(1);
    expect(mockPrisma.books.findUnique).not.toHaveBeenCalled();
    expect(mockPrisma.book_question.create).not.toHaveBeenCalled();
  });

  it("returns 403 when a non-admin user creates a question", async () => {
    mockRequireAdmin.mockResolvedValue(authResponse(403));

    const response = await POST(
      makeJsonRequest("POST", "http://localhost/api/books/101/questions", createPayload),
      { params: Promise.resolve({ id: "101" }) }
    );

    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toEqual({ error: "Admin access required." });
    expect(mockRequireAdmin).toHaveBeenCalledTimes(1);
    expect(mockPrisma.books.findUnique).not.toHaveBeenCalled();
    expect(mockPrisma.book_question.create).not.toHaveBeenCalled();
  });

  it("allows an admin to create a question", async () => {
    mockRequireAdmin.mockResolvedValue(adminResult);
    mockPrisma.books.findUnique.mockResolvedValue({ id: 101n });
    mockPrisma.book_question.create.mockResolvedValue({
      id: "q_new",
      bookId: 101n,
      questionText: createPayload.questionText,
      questionType: createPayload.questionType,
      sortOrder: createPayload.sortOrder,
      correctAnswer: createPayload.correctAnswer,
      options: [
        { id: "q_new_a", optionKey: "A", optionText: createPayload.options[0].optionText, sortOrder: 0 },
        { id: "q_new_b", optionKey: "B", optionText: createPayload.options[1].optionText, sortOrder: 1 },
      ],
    });

    const response = await POST(
      makeJsonRequest("POST", "http://localhost/api/books/101/questions", createPayload),
      { params: Promise.resolve({ id: "101" }) }
    );

    const body = await response.json();

    expect(response.status).toBe(201);
    expect(mockRequireAdmin).toHaveBeenCalledTimes(1);
    expect(mockPrisma.books.findUnique).toHaveBeenCalledWith({
      where: { id: 101n },
      select: { id: true },
    });
    expect(mockPrisma.book_question.create).toHaveBeenCalledWith({
      data: {
        bookId: 101n,
        questionText: createPayload.questionText,
        questionType: createPayload.questionType,
        sortOrder: createPayload.sortOrder,
        correctAnswer: createPayload.correctAnswer,
        options: {
          create: createPayload.options,
        },
      },
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
    expect(body.question).toMatchObject({
      id: "q_new",
      bookId: "101",
      correctAnswer: "A",
      options: [
        { id: "q_new_a", optionKey: "A", sortOrder: 0 },
        { id: "q_new_b", optionKey: "B", sortOrder: 1 },
      ],
    });
  });
});

describe("/api/books/[id]/questions/[questionId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(async (callback) => callback(mockTx));
  });

  it("returns 401 when an unauthenticated user updates a question", async () => {
    mockRequireAdmin.mockResolvedValue(authResponse(401));

    const response = await PATCH(
      makeJsonRequest("PATCH", "http://localhost/api/books/101/questions/q_1", {
        questionText: "Updated?",
      }),
      { params: Promise.resolve({ id: "101", questionId: "q_1" }) }
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Authentication required." });
    expect(mockRequireAdmin).toHaveBeenCalledTimes(1);
    expect(mockPrisma.book_question.findFirst).not.toHaveBeenCalled();
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("returns 403 when a non-admin user updates a question", async () => {
    mockRequireAdmin.mockResolvedValue(authResponse(403));

    const response = await PATCH(
      makeJsonRequest("PATCH", "http://localhost/api/books/101/questions/q_1", {
        questionText: "Updated?",
      }),
      { params: Promise.resolve({ id: "101", questionId: "q_1" }) }
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Admin access required." });
    expect(mockRequireAdmin).toHaveBeenCalledTimes(1);
    expect(mockPrisma.book_question.findFirst).not.toHaveBeenCalled();
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("allows an admin to update a question", async () => {
    mockRequireAdmin.mockResolvedValue(adminResult);
    mockPrisma.book_question.findFirst.mockResolvedValue({ id: "q_1" });
    mockTx.book_question.update.mockResolvedValue({ id: "q_1" });
    mockTx.book_question_option.deleteMany.mockResolvedValue({ count: 2 });
    mockTx.book_question_option.createMany.mockResolvedValue({ count: 2 });
    mockTx.book_question.findUnique.mockResolvedValue({
      id: "q_1",
      bookId: 101n,
      questionText: "Updated question?",
      questionType: "multiple_choice",
      sortOrder: 3,
      correctAnswer: "B",
      options: [
        { id: "q_1_b", optionKey: "B", optionText: "Because of friendship", sortOrder: 0 },
        { id: "q_1_c", optionKey: "C", optionText: "Because of a map", sortOrder: 1 },
      ],
    });

    const response = await PATCH(
      makeJsonRequest("PATCH", "http://localhost/api/books/101/questions/q_1", {
        questionText: "Updated question?",
        sortOrder: 3,
        correctAnswer: "B",
        options: [
          { optionKey: "B", optionText: "Because of friendship", sortOrder: 0 },
          { optionKey: "C", optionText: "Because of a map", sortOrder: 1 },
        ],
      }),
      { params: Promise.resolve({ id: "101", questionId: "q_1" }) }
    );

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockRequireAdmin).toHaveBeenCalledTimes(1);
    expect(mockPrisma.book_question.findFirst).toHaveBeenCalledWith({
      where: { id: "q_1", bookId: 101n },
      select: { id: true },
    });
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mockTx.book_question.update).toHaveBeenCalledWith({
      where: { id: "q_1" },
      data: {
        questionText: "Updated question?",
        sortOrder: 3,
        correctAnswer: "B",
      },
    });
    expect(mockTx.book_question_option.deleteMany).toHaveBeenCalledWith({
      where: { questionId: "q_1" },
    });
    expect(mockTx.book_question_option.createMany).toHaveBeenCalledWith({
      data: [
        { questionId: "q_1", optionKey: "B", optionText: "Because of friendship", sortOrder: 0 },
        { questionId: "q_1", optionKey: "C", optionText: "Because of a map", sortOrder: 1 },
      ],
    });
    expect(body.question).toMatchObject({
      id: "q_1",
      bookId: "101",
      questionText: "Updated question?",
      correctAnswer: "B",
    });
  });

  it("returns 401 when an unauthenticated user deletes a question", async () => {
    mockRequireAdmin.mockResolvedValue(authResponse(401));

    const response = await DELETE(new NextRequest("http://localhost/api/books/101/questions/q_1"), {
      params: Promise.resolve({ id: "101", questionId: "q_1" }),
    });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Authentication required." });
    expect(mockRequireAdmin).toHaveBeenCalledTimes(1);
    expect(mockPrisma.book_question.findFirst).not.toHaveBeenCalled();
    expect(mockPrisma.book_question.delete).not.toHaveBeenCalled();
  });

  it("returns 403 when a non-admin user deletes a question", async () => {
    mockRequireAdmin.mockResolvedValue(authResponse(403));

    const response = await DELETE(new NextRequest("http://localhost/api/books/101/questions/q_1"), {
      params: Promise.resolve({ id: "101", questionId: "q_1" }),
    });

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Admin access required." });
    expect(mockRequireAdmin).toHaveBeenCalledTimes(1);
    expect(mockPrisma.book_question.findFirst).not.toHaveBeenCalled();
    expect(mockPrisma.book_question.delete).not.toHaveBeenCalled();
  });

  it("allows an admin to delete a question", async () => {
    mockRequireAdmin.mockResolvedValue(adminResult);
    mockPrisma.book_question.findFirst.mockResolvedValue({ id: "q_1" });
    mockPrisma.book_question.delete.mockResolvedValue({ id: "q_1" });

    const response = await DELETE(new NextRequest("http://localhost/api/books/101/questions/q_1"), {
      params: Promise.resolve({ id: "101", questionId: "q_1" }),
    });

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ deleted: true });
    expect(mockRequireAdmin).toHaveBeenCalledTimes(1);
    expect(mockPrisma.book_question.findFirst).toHaveBeenCalledWith({
      where: { id: "q_1", bookId: 101n },
      select: { id: true },
    });
    expect(mockPrisma.book_question.delete).toHaveBeenCalledWith({
      where: { id: "q_1" },
    });
  });
});
