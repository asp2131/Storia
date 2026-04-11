import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!id) {
    return NextResponse.json(
      { error: { code: "invalid_request", message: "bookId is required" } },
      { status: 400 }
    );
  }

  try {
    const questions = await prisma.book_question.findMany({
      where: { bookId: BigInt(id) },
      orderBy: { sortOrder: "asc" },
      include: {
        options: {
          orderBy: { sortOrder: "asc" },
          select: {
            id: true,
            optionKey: true,
            optionText: true,
          },
        },
      },
    });

    return NextResponse.json({
      questions: questions.map((q) => ({
        id: q.id,
        bookId: q.bookId.toString(),
        questionText: q.questionText,
        questionType: q.questionType,
        sortOrder: q.sortOrder,
        options: q.options,
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
