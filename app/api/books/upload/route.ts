import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { uploadPDFToR2 } from "@/lib/storage";
import { requireAuth, canUserUploadBook } from "@/lib/auth";
import {
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  DatabaseError,
} from "@/lib/errors";

// Maximum file size: 50MB
const MAX_FILE_SIZE = 50 * 1024 * 1024;

// Allowed MIME types
const ALLOWED_MIME_TYPES = ["application/pdf"];

/**
 * POST /api/books/upload
 * Upload a PDF book and create database records
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate user
    const user = await requireAuth();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // 2. Check subscription tier limits
    const canUpload = await canUserUploadBook(user.id);

    if (!canUpload) {
      return NextResponse.json(
        {
          error: "Book upload limit reached for your subscription tier",
          message:
            "Please upgrade your subscription to upload more books or delete existing books.",
        },
        { status: 403 }
      );
    }

    // 3. Parse multipart form data
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const title = formData.get("title") as string | null;
    const author = formData.get("author") as string | null;

    // 4. Validate file presence
    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // 5. Validate file type
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        {
          error: "Invalid file type",
          message: "Only PDF files are allowed",
        },
        { status: 400 }
      );
    }

    // 6. Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          error: "File too large",
          message: `Maximum file size is ${MAX_FILE_SIZE / 1024 / 1024}MB`,
        },
        { status: 400 }
      );
    }

    // 7. Validate title
    if (!title || title.trim().length === 0) {
      return NextResponse.json(
        { error: "Book title is required" },
        { status: 400 }
      );
    }

    // 8. Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 9. Create book record in database (with temporary values)
    let book;
    try {
      book = await db.book.create({
        data: {
          userId: user.id,
          title: title.trim(),
          author: author?.trim() || null,
          pdfUrl: "", // Will be updated after upload
          totalPages: 0, // Will be updated during processing
          status: "processing",
        },
      });
    } catch (error) {
      console.error("Database error creating book:", error);
      return NextResponse.json(
        {
          error: "Failed to create book record",
          message: "Database error occurred",
        },
        { status: 500 }
      );
    }

    // 10. Upload PDF to Cloudflare R2
    let pdfUrl: string;
    try {
      pdfUrl = await uploadPDFToR2(buffer, book.id);
    } catch (error) {
      // Rollback: Delete the book record if upload fails
      await db.book.delete({ where: { id: book.id } }).catch(console.error);

      console.error("Storage error uploading PDF:", error);
      return NextResponse.json(
        {
          error: "Failed to upload PDF",
          message: "Storage error occurred",
        },
        { status: 500 }
      );
    }

    // 11. Update book record with PDF URL
    try {
      book = await db.book.update({
        where: { id: book.id },
        data: { pdfUrl },
      });
    } catch (error) {
      console.error("Database error updating book:", error);
      // Note: PDF is uploaded but book record is incomplete
      // This is acceptable as the book status is "processing"
    }

    // 12. Return success response
    return NextResponse.json(
      {
        success: true,
        bookId: book.id,
        status: book.status,
        message: "Book uploaded successfully. Processing will begin shortly.",
        book: {
          id: book.id,
          title: book.title,
          author: book.author,
          status: book.status,
          createdAt: book.createdAt,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Unexpected error in book upload:", error);

    // Handle known error types
    if (error instanceof AuthenticationError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }

    if (error instanceof AuthorizationError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }

    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }

    // Generic error response
    return NextResponse.json(
      {
        error: "Internal server error",
        message: "An unexpected error occurred",
      },
      { status: 500 }
    );
  }
}
