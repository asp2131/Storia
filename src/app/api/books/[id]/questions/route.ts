import { NextRequest, NextResponse } from "next/server";
import { requireBookAccess } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

type ParsedOption = {
  optionKey: string;
  optionText: string;
  sortOrder: number;
};

const invalidRequest = (
  message: string,
  field: string,
  details?: Record<string, unknown>
) =>
  NextResponse.json(
    {
      error: {
        code: "invalid_request",
        message,
        details: { field, ...details },
      },
    },
    { status: 400 }
  );

const parseBookId = (value: string) => {
  if (!value.trim()) return null;

  try {
    const bookId = BigInt(value);
    return bookId > 0n ? bookId : null;
  } catch {
    return null;
  }
};

const parseOptions = (value: unknown): ParsedOption[] | null => {
  if (!Array.isArray(value)) return null;

  const parsed: ParsedOption[] = [];
  for (let i = 0; i < value.length; i += 1) {
    const raw = value[i];
    if (!raw || typeof raw !== "object") return null;

    const optionKey =
      typeof (raw as { optionKey?: unknown }).optionKey === "string"
        ? ((raw as { optionKey: string }).optionKey).trim()
        : "";
    const optionText =
      typeof (raw as { optionText?: unknown }).optionText === "string"
        ? ((raw as { optionText: string }).optionText).trim()
        : "";
    const sortOrderRaw = (raw as { sortOrder?: unknown }).sortOrder;
    const sortOrder =
      typeof sortOrderRaw === "number" && Number.isFinite(sortOrderRaw)
        ? Math.trunc(sortOrderRaw)
        : i;

    if (!optionKey || !optionText) return null;

    parsed.push({ optionKey, optionText, sortOrder });
  }

  return parsed;
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const bookId = parseBookId(id ?? "");

  if (bookId === null) {
    return invalidRequest("bookId must be a positive integer", "bookId");
  }

  try {
    const questions = await prisma.book_question.findMany({
      where: { bookId },
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

    return NextResponse.json({
      questions: questions.map((question) => ({
        id: question.id,
        bookId: question.bookId.toString(),
        questionText: question.questionText,
        questionType: question.questionType,
        sortOrder: question.sortOrder,
        options: question.options.map((option) => ({
          id: option.id,
          optionKey: option.optionKey,
          optionText: option.optionText,
          sortOrder: option.sortOrder,
        })),
      })),
    });
  } catch (error) {
    console.error("Error fetching book questions:", error);
    return NextResponse.json(
      { error: { code: "internal_error", message: "Failed to fetch questions" } },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const bookId = parseBookId(id ?? "");

  if (bookId === null) {
    return invalidRequest("bookId must be a positive integer", "bookId");
  }

  const authResult = await requireBookAccess(id);
  if (authResult instanceof NextResponse) return authResult;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return invalidRequest("Request body must be valid JSON", "body");
  }

  if (!body || typeof body !== "object") {
    return invalidRequest("Request body must be a JSON object", "body");
  }

  const {
    questionText,
    questionType,
    sortOrder,
    correctAnswer,
    options,
  } = body as {
    questionText?: unknown;
    questionType?: unknown;
    sortOrder?: unknown;
    correctAnswer?: unknown;
    options?: unknown;
  };

  if (typeof questionText !== "string" || !questionText.trim()) {
    return invalidRequest("questionText is required", "questionText");
  }

  if (typeof correctAnswer !== "string" || !correctAnswer.trim()) {
    return invalidRequest("correctAnswer is required", "correctAnswer");
  }

  const resolvedType =
    typeof questionType === "string" && questionType.trim()
      ? questionType.trim()
      : "multiple_choice";

  const resolvedSortOrder =
    typeof sortOrder === "number" && Number.isFinite(sortOrder)
      ? Math.trunc(sortOrder)
      : 0;

  const parsedOptions = parseOptions(options);
  if (parsedOptions === null) {
    return invalidRequest(
      "options must be an array of { optionKey, optionText, sortOrder? }",
      "options"
    );
  }

  const optionKeys = parsedOptions.map((o) => o.optionKey);
  if (new Set(optionKeys).size !== optionKeys.length) {
    return invalidRequest("options must not contain duplicate optionKey values", "options");
  }

  if (parsedOptions.length > 0 && !optionKeys.includes(correctAnswer.trim())) {
    return invalidRequest(
      "correctAnswer must match one of the provided option keys",
      "correctAnswer"
    );
  }

  try {
    const bookExists = await prisma.books.findUnique({
      where: { id: bookId },
      select: { id: true },
    });

    if (!bookExists) {
      return NextResponse.json(
        { error: { code: "not_found", message: "Book not found" } },
        { status: 404 }
      );
    }

    const created = await prisma.book_question.create({
      data: {
        bookId,
        questionText: questionText.trim(),
        questionType: resolvedType,
        sortOrder: resolvedSortOrder,
        correctAnswer: correctAnswer.trim(),
        options: {
          create: parsedOptions.map((option) => ({
            optionKey: option.optionKey,
            optionText: option.optionText,
            sortOrder: option.sortOrder,
          })),
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

    return NextResponse.json(
      {
        question: {
          id: created.id,
          bookId: created.bookId.toString(),
          questionText: created.questionText,
          questionType: created.questionType,
          sortOrder: created.sortOrder,
          correctAnswer: created.correctAnswer,
          options: created.options,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating book question:", error);
    return NextResponse.json(
      { error: { code: "internal_error", message: "Failed to create question" } },
      { status: 500 }
    );
  }
}
