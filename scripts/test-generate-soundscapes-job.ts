/**
 * Test script for soundscape generation background job
 * 
 * This script tests the error handling and progress tracking
 * of the background job endpoint.
 */

import { db } from "../lib/db";

async function testGenerateSoundscapesJob() {
  console.log("🧪 Testing Soundscape Generation Job\n");

  try {
    // 1. Find a book to test with
    const book = await db.book.findFirst({
      where: {
        status: "processing",
      },
      include: {
        pages: {
          take: 5,
          orderBy: { pageNumber: "asc" },
        },
      },
    });

    if (!book) {
      console.log("❌ No books found with status 'processing'");
      console.log("💡 Upload a book first to test the job");
      return;
    }

    console.log(`📖 Found book: ${book.title}`);
    console.log(`   ID: ${book.id}`);
    console.log(`   Status: ${book.status}`);
    console.log(`   Total Pages: ${book.totalPages}`);
    console.log(`   Pages loaded: ${book.pages.length}`);

    // 2. Test the endpoint
    console.log("\n🚀 Triggering soundscape generation job...");
    
    const response = await fetch("http://localhost:3000/api/generate-soundscapes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ bookId: book.id }),
    });

    const result = await response.json();

    console.log("\n📊 Job Response:");
    console.log(JSON.stringify(result, null, 2));

    // 3. Check updated book status
    const updatedBook = await db.book.findUnique({
      where: { id: book.id },
      include: {
        _count: {
          select: {
            scenes: true,
            pages: true,
          },
        },
      },
    });

    console.log("\n📖 Updated Book Status:");
    console.log(`   Status: ${updatedBook?.status}`);
    console.log(`   Scenes: ${updatedBook?._count.scenes}`);
    console.log(`   Pages: ${updatedBook?._count.pages}`);
    console.log(`   Updated: ${updatedBook?.updatedAt}`);

    const processingErrors = (updatedBook as any)?.processingErrors;
    if (processingErrors) {
      console.log(`\n❌ Processing Errors:`);
      console.log(JSON.stringify(processingErrors, null, 2));
    }

    console.log("\n✅ Test complete!");

  } catch (error) {
    console.error("\n❌ Test failed:", error);
    throw error;
  } finally {
    await db.$disconnect();
  }
}

// Run the test
testGenerateSoundscapesJob().catch(console.error);
