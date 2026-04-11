import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/child-auth";
import { prisma } from "@/lib/prisma";

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
    const { displayName, ageBand, readingLevel, isDefault } = body;

    if (!displayName || typeof displayName !== "string" || !displayName.trim()) {
      return NextResponse.json(
        { error: { code: "invalid_request", message: "displayName is required", details: { field: "displayName" } } },
        { status: 400 }
      );
    }

    if (!ageBand || typeof ageBand !== "string") {
      return NextResponse.json(
        { error: { code: "invalid_request", message: "ageBand is required", details: { field: "ageBand" } } },
        { status: 400 }
      );
    }

    // If this profile is default, unset others
    if (isDefault) {
      await prisma.child_profile.updateMany({
        where: { userId: result.user.id, isDefault: true },
        data: { isDefault: false },
      });
    }

    const childProfile = await prisma.child_profile.create({
      data: {
        userId: result.user.id,
        displayName: displayName.trim(),
        ageBand,
        readingLevel: readingLevel || null,
        isDefault: isDefault || false,
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
