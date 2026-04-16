import { NextRequest, NextResponse } from "next/server";
import { validateChildAccess } from "@/lib/child-auth";
import { prisma } from "@/lib/prisma";

type ParsedAnswer = {
  questionId: string;
  selectedAnswer: string;
};

const invalidRequest = (message: string, field: string, details?: Record<string, unknown>) =>
  NextResponse.json(
    {
      error: {
        code: "invalid_request",
        message,
        details: {
          field,
          ...details,
        },
      },
    },
    { status: 400 }
  );

const parseBookId = (value: unknown) => {
  if (typeof value !== "string" || !value.trim()) return null;

  try {
    const bookId = BigInt(value);
    return bookId > 0n ? bookId : null;
  } catch {
    return null;
  }
};

const parseAnswers = (value: unknown): ParsedAnswer[] | null => {
  if (!Array.isArray(value) || value.length === 0) {
    return null;
  }

  const parsedAnswers: ParsedAnswer[] = [];

  for (let index = 0; index < value.length; index += 1) {
    const answer = value[index];
    if (!answer || typeof answer !== "object") return null;

    const questionId = typeof answer.questionId === "string" ? answer.questionId.trim() : "";
    const selectedAnswer = typeof answer.selectedAnswer === "string" ? answer.selectedAnswer.trim() : "";

    if (!questionId || !selectedAnswer) return null;

    parsedAnswers.push({ questionId, selectedAnswer });
  }

  return parsedAnswers;
};

export async function POST(request: NextRequest) {
  try {
    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return invalidRequest("Request body must be valid JSON", "body");
    }

    if (!body || typeof body !== "object") {
      return invalidRequest("Request body must be a JSON object", "body");
    }

    const { childProfileId, bookId: rawBookId, readingSessionId, answers } = body as {
      childProfileId?: unknown;
      bookId?: unknown;
      readingSessionId?: unknown;
      answers?: unknown;
    };

    if (typeof childProfileId !== "string" || !childProfileId.trim()) {
      return invalidRequest("childProfileId is required", "childProfileId");
    }

    const bookId = parseBookId(rawBookId);
    if (bookId === null) {
      return invalidRequest("bookId must be a positive integer", "bookId");
    }

    if (
      readingSessionId !== undefined &&
      readingSessionId !== null &&
      (typeof readingSessionId !== "string" || !readingSessionId.trim())
    ) {
      return invalidRequest("readingSessionId must be a non-empty string", "readingSessionId");
    }

    const parsedAnswers = parseAnswers(answers);
    if (parsedAnswers === null) {
      return invalidRequest(
        "answers must be a non-empty array of { questionId, selectedAnswer }",
        "answers"
      );
    }

    const uniqueQuestionIds = new Set(parsedAnswers.map((answer) => answer.questionId));
    if (uniqueQuestionIds.size !== parsedAnswers.length) {
      return invalidRequest("answers must not contain duplicate questionId values", "answers");
    }

    const result = await validateChildAccess(childProfileId.trim());
    if ("error" in result) return result.error;

    const questions = await prisma.book_question.findMany({
      where: {
        id: { in: [...uniqueQuestionIds] },
        bookId,
      },
      select: {
        id: true,
        correctAnswer: true,
      },
    });

    if (questions.length !== parsedAnswers.length) {
      const foundQuestionIds = new Set(questions.map((question) => question.id));
      const unknownQuestionIds = parsedAnswers
        .map((answer) => answer.questionId)
        .filter((questionId) => !foundQuestionIds.has(questionId));

      return invalidRequest(
        "One or more questionIds are invalid for this book",
        "answers",
        { questionIds: unknownQuestionIds }
      );
    }

    const questionMap = new Map(questions.map((question) => [question.id, question]));

    let correctCount = 0;
    const answerResults = parsedAnswers.map((answer) => {
      const question = questionMap.get(answer.questionId)!;
      const isCorrect = question.correctAnswer === answer.selectedAnswer;

      if (isCorrect) {
        correctCount += 1;
      }

      return {
        questionId: answer.questionId,
        selectedAnswer: answer.selectedAnswer,
        isCorrect,
      };
    });

    await prisma.question_attempt.createMany({
      data: answerResults.map((answer) => ({
        userId: result.user.id,
        childProfileId: result.childProfile.id,
        bookId,
        questionId: answer.questionId,
        readingSessionId: typeof readingSessionId === "string" ? readingSessionId.trim() : null,
        selectedAnswer: answer.selectedAnswer,
        isCorrect: answer.isCorrect,
      })),
    });

    const totalQuestions = answerResults.length;
    const scorePercent = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
    const submittedAt = new Date().toISOString();

    return NextResponse.json({
      result: {
        bookId: bookId.toString(),
        childProfileId: result.childProfile.id,
        totalQuestions,
        correctCount,
        scorePercent,
        submittedAt,
      },
      answerResults,
    });
  } catch (error) {
    console.error("Error submitting comprehension:", error);
    return NextResponse.json(
      { error: { code: "internal_error", message: "Failed to submit comprehension answers" } },
      { status: 500 }
    );
  }
}
