import { NextRequest, NextResponse } from "next/server";
import { validateChildAccess } from "@/lib/child-auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { childProfileId, bookId, readingSessionId, answers } = body;

    if (!childProfileId) {
      return NextResponse.json(
        { error: { code: "invalid_request", message: "childProfileId is required" } },
        { status: 400 }
      );
    }
    if (!bookId) {
      return NextResponse.json(
        { error: { code: "invalid_request", message: "bookId is required" } },
        { status: 400 }
      );
    }
    if (!answers || !Array.isArray(answers) || answers.length === 0) {
      return NextResponse.json(
        { error: { code: "invalid_request", message: "answers array is required and must not be empty" } },
        { status: 400 }
      );
    }

    const result = await validateChildAccess(childProfileId);
    if ("error" in result) return result.error;

    // Fetch all questions for this book to check answers
    const questionIds = answers.map((a: { questionId: string }) => a.questionId);
    const questions = await prisma.book_question.findMany({
      where: {
        id: { in: questionIds },
        bookId: BigInt(bookId),
      },
    });

    const questionMap = new Map(questions.map((q) => [q.id, q]));

    // Score and create attempts
    let correctCount = 0;
    const attempts = answers.map((answer: { questionId: string; selectedAnswer: string }) => {
      const question = questionMap.get(answer.questionId);
      const isCorrect = question ? question.correctAnswer === answer.selectedAnswer : false;
      if (isCorrect) correctCount++;

      return {
        userId: result.user.id,
        childProfileId,
        bookId: BigInt(bookId),
        questionId: answer.questionId,
        readingSessionId: readingSessionId || null,
        selectedAnswer: answer.selectedAnswer,
        isCorrect,
      };
    });

    await prisma.question_attempt.createMany({ data: attempts });

    const totalQuestions = answers.length;
    const scorePercent = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;

    return NextResponse.json({
      result: {
        bookId: bookId.toString(),
        childProfileId,
        totalQuestions,
        correctCount,
        scorePercent,
        submittedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Error submitting comprehension:", error);
    return NextResponse.json(
      { error: { code: "internal_error", message: "Failed to submit comprehension answers" } },
      { status: 500 }
    );
  }
}
