/**
 * Background Job: Generate Soundscapes for a Book
 * 
 * This endpoint processes a book's pages in 2-page spreads, analyzes content,
 * detects scene changes, and generates soundscapes. Includes comprehensive
 * error handling, retry logic, and progress tracking.
 * 
 * Requirements: 3.3, 4.1, 4.4, 9.1, 9.2, 9.3
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { analyzePageSpreadWithRetry } from "@/lib/analyzeContent";
import { detectSceneChange } from "@/lib/sceneDetection";
import { generateSoundscapeWithRetry } from "@/lib/generateSoundscape";
import { withRetry } from "@/lib/retry";
import type { SceneAnalysis } from "@/lib/analyzeContent";

/**
 * Error details stored in database for debugging
 */
interface ProcessingError {
  timestamp: string;
  spreadIndex: number;
  pageNumbers: number[];
  errorType: string;
  errorMessage: string;
  stack?: string;
  attemptNumber: number;
}

/**
 * Processing statistics for logging
 */
interface ProcessingStats {
  totalSpreads: number;
  processedSpreads: number;
  scenesCreated: number;
  soundscapesGenerated: number;
  errors: ProcessingError[];
  startTime: number;
  endTime?: number;
}

/**
 * POST /api/generate-soundscapes
 * Generate soundscapes for a book
 * 
 * Request body:
 * {
 *   bookId: string
 * }
 */
export async function POST(request: NextRequest) {
  let bookId: string | undefined;
  const stats: ProcessingStats = {
    totalSpreads: 0,
    processedSpreads: 0,
    scenesCreated: 0,
    soundscapesGenerated: 0,
    errors: [],
    startTime: Date.now(),
  };

  try {
    // 1. Parse request body
    const body = await request.json();
    bookId = body.bookId;

    if (!bookId) {
      return NextResponse.json(
        { error: "bookId is required" },
        { status: 400 }
      );
    }

    console.log(`🚀 Starting soundscape generation for book ${bookId}`);

    // 2. Fetch book with pages
    const book = await db.book.findUnique({
      where: { id: bookId },
      include: {
        pages: {
          orderBy: { pageNumber: "asc" },
        },
      },
    });

    if (!book) {
      return NextResponse.json(
        { error: "Book not found" },
        { status: 404 }
      );
    }

    if (book.pages.length === 0) {
      console.error(`❌ Book ${bookId} has no pages to process`);
      await updateBookStatus(bookId, "failed", [{
        timestamp: new Date().toISOString(),
        spreadIndex: 0,
        pageNumbers: [],
        errorType: "ValidationError",
        errorMessage: "Book has no pages to process",
        attemptNumber: 1,
      }]);
      
      return NextResponse.json(
        { error: "Book has no pages to process" },
        { status: 400 }
      );
    }

    console.log(`📖 Processing ${book.pages.length} pages in ${Math.ceil(book.pages.length / 2)} spreads`);
    stats.totalSpreads = Math.ceil(book.pages.length / 2);

    // 3. Update book status to processing
    await db.book.update({
      where: { id: bookId },
      data: { status: "processing" },
    });

    // 4. Process pages in 2-page spreads
    let previousAnalysis: SceneAnalysis | null = null;
    let currentScene: { id: string; startPage: number } | null = null;

    for (let i = 0; i < book.pages.length; i += 2) {
      const spreadIndex = Math.floor(i / 2);
      const page1 = book.pages[i];
      const page2 = book.pages[i + 1];

      console.log(`\n📄 Processing spread ${spreadIndex + 1}/${stats.totalSpreads} (pages ${page1.pageNumber}${page2 ? `-${page2.pageNumber}` : ""})`);

      try {
        // 4a. Analyze page spread with retry logic (max 3 attempts)
        const analysis = await analyzePageSpreadWithRetry(
          page1.textContent,
          page2?.textContent || "",
          page1.pageNumber,
          3
        );

        console.log(`✅ Analysis complete: ${analysis.setting} | ${analysis.mood} | ${analysis.intensity}`);

        // 4b. Detect scene change
        const isNewScene = previousAnalysis
          ? await detectSceneChange(previousAnalysis, analysis)
          : true; // First spread is always a new scene

        if (isNewScene) {
          console.log(`🎬 New scene detected at spread ${spreadIndex}`);

          // Close previous scene if exists
          if (currentScene) {
            await db.scene.update({
              where: { id: currentScene.id },
              data: { endPage: page1.pageNumber - 1 },
            });
          }

          // 4c. Create new scene
          const scene = await withRetry(
            async () =>
              db.scene.create({
                data: {
                  bookId: book.id,
                  startPage: page1.pageNumber,
                  endPage: page2?.pageNumber || page1.pageNumber,
                  pageSpreadIndex: spreadIndex,
                  setting: analysis.setting,
                  mood: analysis.mood,
                  descriptors: analysis as any,
                },
              }),
            3
          );

          stats.scenesCreated++;
          currentScene = { id: scene.id, startPage: page1.pageNumber };
          console.log(`✅ Scene created: ${scene.id}`);

          // 4d. Generate soundscape with retry logic (max 3 attempts)
          try {
            const soundscape = await generateSoundscapeWithRetry(
              analysis,
              scene.id,
              3
            );

            // 4e. Store soundscape in database
            await withRetry(
              async () =>
                db.soundscape.create({
                  data: {
                    sceneId: scene.id,
                    audioUrl: soundscape.audioUrl,
                    duration: soundscape.duration,
                    generationPrompt: soundscape.prompt,
                    replicatePredictionId: soundscape.predictionId,
                  },
                }),
              3
            );

            stats.soundscapesGenerated++;
            console.log(`✅ Soundscape generated and stored`);
          } catch (soundscapeError) {
            // Log error but continue processing remaining scenes
            const error = soundscapeError instanceof Error ? soundscapeError : new Error(String(soundscapeError));
            console.error(`❌ Failed to generate soundscape for scene ${scene.id}:`, error.message);
            
            stats.errors.push({
              timestamp: new Date().toISOString(),
              spreadIndex,
              pageNumbers: [page1.pageNumber, page2?.pageNumber].filter(Boolean) as number[],
              errorType: error.name || "SoundscapeGenerationError",
              errorMessage: error.message,
              stack: error.stack,
              attemptNumber: 3, // After all retries
            });

            // Continue processing - don't throw
          }

          // 4f. Update pages with scene reference
          await withRetry(
            async () =>
              db.page.updateMany({
                where: {
                  bookId: book.id,
                  pageNumber: {
                    in: [page1.pageNumber, page2?.pageNumber].filter(Boolean) as number[],
                  },
                },
                data: { sceneId: scene.id },
              }),
            3
          );
        } else {
          console.log(`📖 Continuing current scene`);

          // Update current scene end page
          if (currentScene) {
            await db.scene.update({
              where: { id: currentScene.id },
              data: { endPage: page2?.pageNumber || page1.pageNumber },
            });
          }

          // Update pages with current scene reference
          await withRetry(
            async () =>
              db.page.updateMany({
                where: {
                  bookId: book.id,
                  pageNumber: {
                    in: [page1.pageNumber, page2?.pageNumber].filter(Boolean) as number[],
                  },
                },
                data: { sceneId: currentScene?.id },
              }),
            3
          );
        }

        previousAnalysis = analysis;
        stats.processedSpreads++;

      } catch (spreadError) {
        // Log error for this spread but continue processing
        const error = spreadError instanceof Error ? spreadError : new Error(String(spreadError));
        console.error(`❌ Failed to process spread ${spreadIndex}:`, error.message);
        
        stats.errors.push({
          timestamp: new Date().toISOString(),
          spreadIndex,
          pageNumbers: [page1.pageNumber, page2?.pageNumber].filter(Boolean) as number[],
          errorType: error.name || "SpreadProcessingError",
          errorMessage: error.message,
          stack: error.stack,
          attemptNumber: 3, // After all retries
        });

        // Continue to next spread
        continue;
      }
    }

    stats.endTime = Date.now();
    const processingTime = ((stats.endTime - stats.startTime) / 1000).toFixed(2);

    // 5. Update book status based on results
    if (stats.errors.length === 0) {
      // Complete success
      await updateBookStatus(bookId, "ready", []);
      console.log(`\n✅ Book processing complete in ${processingTime}s`);
      console.log(`📊 Stats: ${stats.scenesCreated} scenes, ${stats.soundscapesGenerated} soundscapes`);

      return NextResponse.json({
        success: true,
        bookId: book.id,
        status: "ready",
        stats: {
          totalSpreads: stats.totalSpreads,
          processedSpreads: stats.processedSpreads,
          scenesCreated: stats.scenesCreated,
          soundscapesGenerated: stats.soundscapesGenerated,
          processingTimeSeconds: parseFloat(processingTime),
        },
      });
    } else if (stats.processedSpreads > 0) {
      // Partial success - some spreads processed
      await updateBookStatus(bookId, "ready", stats.errors);
      console.log(`\n⚠️  Book processing completed with errors in ${processingTime}s`);
      console.log(`📊 Stats: ${stats.processedSpreads}/${stats.totalSpreads} spreads, ${stats.scenesCreated} scenes, ${stats.soundscapesGenerated} soundscapes`);
      console.log(`❌ Errors: ${stats.errors.length}`);

      return NextResponse.json({
        success: true,
        bookId: book.id,
        status: "ready",
        warning: "Some spreads failed to process",
        stats: {
          totalSpreads: stats.totalSpreads,
          processedSpreads: stats.processedSpreads,
          scenesCreated: stats.scenesCreated,
          soundscapesGenerated: stats.soundscapesGenerated,
          errorCount: stats.errors.length,
          processingTimeSeconds: parseFloat(processingTime),
        },
        errors: stats.errors.map(e => ({
          spreadIndex: e.spreadIndex,
          pageNumbers: e.pageNumbers,
          errorMessage: e.errorMessage,
        })),
      });
    } else {
      // Complete failure - no spreads processed
      await updateBookStatus(bookId, "failed", stats.errors);
      console.log(`\n❌ Book processing failed in ${processingTime}s`);
      console.log(`❌ All ${stats.totalSpreads} spreads failed`);

      return NextResponse.json({
        success: false,
        bookId: book.id,
        status: "failed",
        error: "All spreads failed to process",
        stats: {
          totalSpreads: stats.totalSpreads,
          errorCount: stats.errors.length,
          processingTimeSeconds: parseFloat(processingTime),
        },
        errors: stats.errors.map(e => ({
          spreadIndex: e.spreadIndex,
          pageNumbers: e.pageNumbers,
          errorMessage: e.errorMessage,
        })),
      }, { status: 500 });
    }

  } catch (error) {
    stats.endTime = Date.now();
    const processingTime = ((stats.endTime - stats.startTime) / 1000).toFixed(2);
    
    console.error(`❌ Unexpected error in soundscape generation job:`, error);

    // Update book status to failed if we have a bookId
    if (bookId) {
      const errorDetails: ProcessingError = {
        timestamp: new Date().toISOString(),
        spreadIndex: -1,
        pageNumbers: [],
        errorType: error instanceof Error ? error.name : "UnknownError",
        errorMessage: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        attemptNumber: 1,
      };

      await updateBookStatus(bookId, "failed", [errorDetails]);
    }

    return NextResponse.json(
      {
        success: false,
        error: "Soundscape generation job failed",
        message: error instanceof Error ? error.message : "Unknown error",
        stats: {
          totalSpreads: stats.totalSpreads,
          processedSpreads: stats.processedSpreads,
          scenesCreated: stats.scenesCreated,
          soundscapesGenerated: stats.soundscapesGenerated,
          errorCount: stats.errors.length + 1,
          processingTimeSeconds: parseFloat(processingTime),
        },
      },
      { status: 500 }
    );
  }
}

/**
 * Update book status and store error details
 */
async function updateBookStatus(
  bookId: string,
  status: "processing" | "ready" | "failed",
  errors: ProcessingError[]
): Promise<void> {
  try {
    await db.book.update({
      where: { id: bookId },
      data: {
        status,
        processingErrors: errors.length > 0 ? errors : null,
        updatedAt: new Date(),
      },
    });

    // Log errors to console for debugging
    if (errors.length > 0) {
      console.log(`\n📝 Error Summary for book ${bookId}:`);
      errors.forEach((error, index) => {
        console.log(`\n  Error ${index + 1}:`);
        console.log(`    Spread: ${error.spreadIndex}`);
        console.log(`    Pages: ${error.pageNumbers.join(", ")}`);
        console.log(`    Type: ${error.errorType}`);
        console.log(`    Message: ${error.errorMessage}`);
        console.log(`    Timestamp: ${error.timestamp}`);
      });
    }
  } catch (updateError) {
    console.error(`❌ Failed to update book status:`, updateError);
    // Don't throw - this is a cleanup operation
  }
}
