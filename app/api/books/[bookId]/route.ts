import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export async function DELETE(
  request: NextRequest,
  { params }: { params: { bookId: string } }
) {
  try {
    // Check authentication
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { bookId } = params;

    // Verify book exists and belongs to user
    const book = await db.book.findUnique({
      where: { id: bookId },
      select: { id: true, userId: true, title: true },
    });

    if (!book) {
      return NextResponse.json(
        { error: "Book not found" },
        { status: 404 }
      );
    }

    if (book.userId !== session.user.id) {
      return NextResponse.json(
        { error: "Unauthorized to delete this book" },
        { status: 403 }
      );
    }

    // Delete book (cascade will handle related records)
    await db.book.delete({
      where: { id: bookId },
    });

    return NextResponse.json({
      success: true,
      message: `Book "${book.title}" deleted successfully`,
    });
  } catch (error) {
    console.error("Error deleting book:", error);
    return NextResponse.json(
      { error: "Failed to delete book" },
      { status: 500 }
    );
  }
}
