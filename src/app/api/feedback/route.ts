import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getAuth } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const auth = getAuth();
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { rating, feedback } = body;

    if (!rating || typeof rating !== "number" || rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: "Rating must be a number between 1 and 5" },
        { status: 400 }
      );
    }

    if (feedback && (typeof feedback !== "string" || feedback.length > 200)) {
      return NextResponse.json(
        { error: "Feedback must be a string with max 200 characters" },
        { status: 400 }
      );
    }

    const feedbackRecord = await prisma.reader_feedback.create({
      data: {
        userId: session.user.id,
        rating,
        feedback: feedback || null,
      },
    });

    return NextResponse.json({
      success: true,
      id: feedbackRecord.id,
    });
  } catch (error) {
    console.error("[feedback] Failed to submit:", error);
    return NextResponse.json(
      { error: "Failed to submit feedback" },
      { status: 500 }
    );
  }
}
