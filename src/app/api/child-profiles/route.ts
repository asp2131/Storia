import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/child-auth";
import { prisma } from "@/lib/prisma";

// Onboarding answers. Unknown values are dropped rather than rejected so an app
// build that ships a new option never blocks a parent from creating a profile.
const PARENT_GOALS = ["improveReading", "reduceScreenTime", "lovesReading"];
const INTERESTS = [
  "adventure",
  "funny",
  "mystery",
  "magicFantasy",
  "spaceScience",
  "oceanWeather",
  "sports",
  "friendshipFeelings",
  "mangaAnime",
  "howThingsWork",
];
const READING_TIMES = ["beforeSchool", "afterSchool", "bedtime", "weekends"];

const pick = (value: unknown, allowed: string[]) =>
  typeof value === "string" && allowed.includes(value) ? value : null;

export async function GET() {
  try {
    const result = await getAuthenticatedUser();
    if ("error" in result) return result.error;

    const childProfiles = await prisma.child_profile.findMany({
      where: { userId: result.user.id },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ childProfiles });
  } catch (error) {
    console.error("Error fetching child profiles:", error);
    return NextResponse.json(
      { error: { code: "internal_error", message: "Failed to fetch child profiles" } },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const result = await getAuthenticatedUser();
    if ("error" in result) return result.error;

    const body = await request.json();
    const { displayName, ageBand, readingLevel, isDefault, parentGoal, interests, readingTime } = body;

    if (!displayName || typeof displayName !== "string" || !displayName.trim()) {
      return NextResponse.json(
        { error: { code: "invalid_request", message: "displayName is required", details: { field: "displayName" } } },
        { status: 400 }
      );
    }

    if (!ageBand || typeof ageBand !== "string" || !ageBand.trim()) {
      return NextResponse.json(
        { error: { code: "invalid_request", message: "ageBand is required", details: { field: "ageBand" } } },
        { status: 400 }
      );
    }

    if (interests != null && !Array.isArray(interests)) {
      return NextResponse.json(
        { error: { code: "invalid_request", message: "interests must be an array", details: { field: "interests" } } },
        { status: 400 }
      );
    }

    if (readingLevel != null && typeof readingLevel !== "string") {
      return NextResponse.json(
        { error: { code: "invalid_request", message: "readingLevel must be a string", details: { field: "readingLevel" } } },
        { status: 400 }
      );
    }

    const existingCount = await prisma.child_profile.count({
      where: { userId: result.user.id },
    });
    const shouldBeDefault = Boolean(isDefault) || existingCount === 0;

    if (shouldBeDefault) {
      await prisma.child_profile.updateMany({
        where: { userId: result.user.id, isDefault: true },
        data: { isDefault: false },
      });
    }

    const childProfile = await prisma.child_profile.create({
      data: {
        userId: result.user.id,
        displayName: displayName.trim(),
        ageBand: ageBand.trim(),
        readingLevel: typeof readingLevel === "string" && readingLevel.trim() ? readingLevel.trim() : null,
        isDefault: shouldBeDefault,
        parentGoal: pick(parentGoal, PARENT_GOALS),
        interests: [...new Set(((interests ?? []) as unknown[]).filter((i) => pick(i, INTERESTS)))] as string[],
        readingTime: pick(readingTime, READING_TIMES),
      },
    });

    return NextResponse.json({ childProfile }, { status: 201 });
  } catch (error) {
    console.error("Error creating child profile:", error);
    return NextResponse.json(
      { error: { code: "internal_error", message: "Failed to create child profile" } },
      { status: 500 }
    );
  }
}
