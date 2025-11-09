import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    // Test database connection
    await db.$queryRaw`SELECT 1`;
    
    // Get counts
    const userCount = await db.user.count();
    const bookCount = await db.book.count();
    
    return NextResponse.json({
      status: "ok",
      database: "connected",
      counts: {
        users: userCount,
        books: bookCount,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        database: "disconnected",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
