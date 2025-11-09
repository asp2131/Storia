import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { extractPDFText, extractPDFMetadata } from "@/lib/pdfProcessorServer";
import { getFromR2 } from "@/lib/storage";

export async function POST(
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

    // Get book
    const book = await db.book.findUnique({
      where: { id: bookId },
    });

    if (!book) {
      return NextResponse.json(
        { error: "Book not found" },
        { status: 404 }
      );
    }

    // Check ownership
    if (book.userId !== session.user.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 }
      );
    }

    // Check if already processed
    if (book.status === "ready") {
      return NextResponse.json({
        success: true,
        message: "Book already processed",
        book,
      });
    }

    console.log(`📖 Starting PDF processing for book: ${bookId}`);

    // Download PDF from R2
    const pdfKey = `books/${bookId}.pdf`;
    const pdfBuffer = await getFromR2(pdfKey);
    console.log(`✅ PDF downloaded from R2: ${pdfBuffer.length} bytes`);

    // Extract metadata
    const metadata = await extractPDFMetadata(pdfBuffer);
    console.log(`✅ Metadata extracted: ${metadata.pageCount} pages`);

    // Extract text from all pages
    const pagesText = await extractPDFText(pdfBuffer);
    console.log(`✅ Text extracted from ${pagesText.length} pages`);

    // Create page records
    const pageRecords = pagesText.map((text, index) => ({
      bookId: bookId,
      pageNumber: index + 1,
      textContent: text,
    }));

    // Save pages to database
    await db.page.createMany({
      data: pageRecords,
    });
    console.log(`✅ Created ${pageRecords.length} page records`);

    // Update book status
    await db.book.update({
      where: { id: bookId },
      data: {
        totalPages: metadata.pageCount,
        status: "ready",
      },
    });
    console.log(`✅ Book marked as ready: ${bookId}`);

    return NextResponse.json({
      success: true,
      message: "Book processed successfully",
      book: {
        id: bookId,
        totalPages: metadata.pageCount,
        status: "ready",
      },
    });
  } catch (error) {
    console.error("❌ Error processing book:", error);

    // Mark book as failed
    try {
      await db.book.update({
        where: { id: params.bookId },
        data: { status: "failed" },
      });
    } catch (updateError) {
      console.error("Failed to update book status:", updateError);
    }

    return NextResponse.json(
      {
        error: "Failed to process book",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
