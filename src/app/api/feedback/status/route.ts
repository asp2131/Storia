import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getAuth } from "@/lib/auth";

const FEEDBACK_COOLDOWN_DAYS = 30;

export async function GET() {
  try {
    const auth = getAuth();
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      // Not logged in - don't show feedback modal
      return NextResponse.json({
        shouldShowFeedback: false,
        reason: "not_authenticated",
      });
    }

    // Get the most recent feedback from this user
    const lastFeedback = await prisma.reader_feedback.findFirst({
      where: {
        userId: session.user.id,
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        createdAt: true,
      },
    });

    if (!lastFeedback) {
      // User has never given feedback
      return NextResponse.json({
        shouldShowFeedback: true,
        lastFeedbackDate: null,
      });
    }

    // Check if 30 days have passed since last feedback
    const daysSinceLastFeedback = Math.floor(
      (Date.now() - lastFeedback.createdAt.getTime()) / (1000 * 60 * 60 * 24)
    );

    const shouldShowFeedback = daysSinceLastFeedback >= FEEDBACK_COOLDOWN_DAYS;

    return NextResponse.json({
      shouldShowFeedback,
      lastFeedbackDate: lastFeedback.createdAt.toISOString(),
      daysSinceLastFeedback,
    });
  } catch (error) {
    console.error("[feedback/status] Failed to check status:", error);
    return NextResponse.json(
      { error: "Failed to check feedback status" },
      { status: 500 }
    );
  }
}
