import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
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

async function resolveParams(
  params: Promise<{ id: string; questionId: string }>
) {
  const { id, questionId } = await params;
  return { id: id ?? "", questionId: (questionId ?? "").trim() };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; questionId: string }> }
) {
  const { id, questionId } = await resolveParams(params);
  const bookId = parseBookId(id);

  if (bookId === null) {
    return invalidRequest("bookId must be a positive integer", "bookId");
  }

  if (!questionId) {
    return invalidRequest("questionId is required", "questionId");
  }

  const authResult = await requireAdmin();
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

  const updateData: {
    questionText?: string;
    questionType?: string;
    sortOrder?: number;
    correctAnswer?: string;
  } = {};

  if (questionText !== undefined) {
    if (typeof questionText !== "string" || !questionText.trim()) {
      return invalidRequest("questionText must be a non-empty string", "questionText");
    }
    updateData.questionText = questionText.trim();
  }

  if (questionType !== undefined) {
    if (typeof questionType !== "string" || !questionType.trim()) {
      return invalidRequest("questionType must be a non-empty string", "questionType");
    }
    updateData.questionType = questionType.trim();
  }

  if (sortOrder !== undefined) {
    if (typeof sortOrder !== "number" || !Number.isFinite(sortOrder)) {
      return invalidRequest("sortOrder must be a finite number", "sortOrder");
    }
    updateData.sortOrder = Math.trunc(sortOrder);
  }

  if (correctAnswer !== undefined) {
    if (typeof correctAnswer !== "string" || !correctAnswer.trim()) {
      return invalidRequest("correctAnswer must be a non-empty string", "correctAnswer");
    }
    updateData.correctAnswer = correctAnswer.trim();
  }

  let parsedOptions: ParsedOption[] | null = null;
  if (options !== undefined) {
    parsedOptions = parseOptions(options);
    if (parsedOptions === null) {
      return invalidRequest(
        "options must be an array of { optionKey, optionText, sortOrder? }",
        "options"
      );
    }
    const keys = parsedOptions.map((o) => o.optionKey);
    if (new Set(keys).size !== keys.length) {
      return invalidRequest("options must not contain duplicate optionKey values", "options");
    }
    const effectiveCorrect =
      updateData.correctAnswer ?? (typeof correctAnswer === "string" ? correctAnswer.trim() : null);
    if (parsedOptions.length > 0 && effectiveCorrect && !keys.includes(effectiveCorrect)) {
      return invalidRequest(
        "correctAnswer must match one of the provided option keys",
        "correctAnswer"
      );
    }
  }

  try {
    const existing = await prisma.book_question.findFirst({
      where: { id: questionId, bookId },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json(
        { error: { code: "not_found", message: "Question not found for book" } },
        { status: 404 }
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (Object.keys(updateData).length > 0) {
        await tx.book_question.update({
          where: { id: questionId },
          data: updateData,
        });
      }

      if (parsedOptions !== null) {
        await tx.book_question_option.deleteMany({
          where: { questionId },
        });
        if (parsedOptions.length > 0) {
          await tx.book_question_option.createMany({
            data: parsedOptions.map((option) => ({
              questionId,
              optionKey: option.optionKey,
              optionText: option.optionText,
              sortOrder: option.sortOrder,
            })),
          });
        }
      }

      return tx.book_question.findUnique({
        where: { id: questionId },
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
    });

    if (!updated) {
      return NextResponse.json(
        { error: { code: "internal_error", message: "Failed to load updated question" } },
        { status: 500 }
      );
    }

    return NextResponse.json({
      question: {
        id: updated.id,
        bookId: updated.bookId.toString(),
        questionText: updated.questionText,
        questionType: updated.questionType,
        sortOrder: updated.sortOrder,
        correctAnswer: updated.correctAnswer,
        options: updated.options,
      },
    });
  } catch (error) {
    console.error("Error updating book question:", error);
    return NextResponse.json(
      { error: { code: "internal_error", message: "Failed to update question" } },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; questionId: string }> }
) {
  const { id, questionId } = await resolveParams(params);
  const bookId = parseBookId(id);

  if (bookId === null) {
    return invalidRequest("bookId must be a positive integer", "bookId");
  }

  if (!questionId) {
    return invalidRequest("questionId is required", "questionId");
  }

  const authResult = await requireAdmin();
  if (authResult instanceof NextResponse) return authResult;

  try {
    const existing = await prisma.book_question.findFirst({
      where: { id: questionId, bookId },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json(
        { error: { code: "not_found", message: "Question not found for book" } },
        { status: 404 }
      );
    }

    await prisma.book_question.delete({
      where: { id: questionId },
    });

    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error("Error deleting book question:", error);
    return NextResponse.json(
      { error: { code: "internal_error", message: "Failed to delete question" } },
      { status: 500 }
    );
  }
}
