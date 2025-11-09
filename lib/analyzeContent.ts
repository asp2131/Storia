/**
 * Content Analysis Module
 * 
 * Analyzes book page content using Google Gemini to extract narrative elements
 * for soundscape generation. This module provides the core content analysis
 * functionality with retry logic and error handling.
 * 
 * Requirements: 3.1, 3.2, 3.4
 */

import { analyzePageContent as geminiAnalyze, analyzePageSpread as geminiAnalyzeSpread, SceneAnalysis } from "./gemini";

/**
 * Re-export SceneAnalysis type for convenience
 */
export type { SceneAnalysis };

/**
 * Analyze a single page of content using Gemini Flash
 * 
 * Extracts narrative elements including:
 * - Setting (physical location/environment)
 * - Mood (emotional tone)
 * - Weather conditions (if mentioned)
 * - Time of day (if mentioned)
 * - Intensity level (low, medium, high)
 * - Key actions and events
 * - Audio prompt for soundscape generation
 * 
 * @param pageText - The text content of the page to analyze
 * @param pageNumber - The page number for context
 * @returns Promise<SceneAnalysis> - Structured analysis of the page content
 * @throws Error if analysis fails after retries
 * 
 * @example
 * ```typescript
 * const analysis = await analyzePageContent(
 *   "The dark forest loomed ahead...",
 *   42
 * );
 * console.log(analysis.setting); // "A dark forest"
 * console.log(analysis.audioPrompt); // "Rustling leaves and distant animal calls..."
 * ```
 */
export async function analyzePageContent(
  pageText: string,
  pageNumber: number
): Promise<SceneAnalysis> {
  // Validate input
  if (!pageText || pageText.trim().length === 0) {
    throw new Error(`Page ${pageNumber} has no text content to analyze`);
  }

  // Use Gemini client with built-in error handling
  return await geminiAnalyze(pageText, pageNumber);
}

/**
 * Analyze a page spread (2 pages) as a single unit
 * 
 * This is the recommended approach for the reading platform as it:
 * - Reduces API calls by 50%
 * - Aligns with react-pageflip page turns
 * - Provides better context for scene detection
 * - Ensures soundscape transitions match visual page flips
 * 
 * @param page1Text - Text content of the first page
 * @param page2Text - Text content of the second page
 * @param startPageNumber - Page number of the first page
 * @returns Promise<SceneAnalysis> - Combined analysis of both pages
 * @throws Error if analysis fails after retries
 * 
 * @example
 * ```typescript
 * const analysis = await analyzePageSpread(
 *   pages[0].textContent,
 *   pages[1].textContent,
 *   1
 * );
 * ```
 */
export async function analyzePageSpread(
  page1Text: string,
  page2Text: string,
  startPageNumber: number
): Promise<SceneAnalysis> {
  // Validate input
  if ((!page1Text || page1Text.trim().length === 0) && 
      (!page2Text || page2Text.trim().length === 0)) {
    throw new Error(`Page spread starting at ${startPageNumber} has no text content to analyze`);
  }

  // Use Gemini client for page spread analysis
  return await geminiAnalyzeSpread(page1Text, page2Text, startPageNumber);
}

/**
 * Analyze page content with automatic retry logic
 * 
 * Implements exponential backoff retry strategy:
 * - Attempt 1: Immediate
 * - Attempt 2: 1 second delay
 * - Attempt 3: 2 second delay
 * - Attempt 4: 4 second delay
 * 
 * This handles transient API failures gracefully and ensures
 * robust content analysis even under network issues.
 * 
 * @param pageText - The text content to analyze
 * @param pageNumber - The page number for context
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 * @returns Promise<SceneAnalysis> - Analysis result
 * @throws Error if all retry attempts fail
 * 
 * @example
 * ```typescript
 * try {
 *   const analysis = await analyzeWithRetry(pageText, 1, 3);
 * } catch (error) {
 *   console.error("Analysis failed after 3 retries:", error);
 * }
 * ```
 */
export async function analyzeWithRetry(
  pageText: string,
  pageNumber: number,
  maxRetries: number = 3
): Promise<SceneAnalysis> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await analyzePageContent(pageText, pageNumber);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Unknown error during analysis");
      
      // Log the error for debugging
      console.error(`Analysis attempt ${attempt + 1}/${maxRetries} failed for page ${pageNumber}:`, error);
      
      // Don't wait after the last attempt
      if (attempt < maxRetries - 1) {
        // Exponential backoff: 1s, 2s, 4s
        const delayMs = Math.pow(2, attempt) * 1000;
        console.log(`Retrying in ${delayMs}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  // All retries exhausted
  throw new Error(
    `Content analysis failed for page ${pageNumber} after ${maxRetries} attempts: ${lastError?.message || "Unknown error"}`
  );
}

/**
 * Analyze page spread with automatic retry logic
 * 
 * Combines page spread analysis with exponential backoff retry strategy.
 * Recommended for production use to handle API failures gracefully.
 * 
 * @param page1Text - Text content of the first page
 * @param page2Text - Text content of the second page
 * @param startPageNumber - Page number of the first page
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 * @returns Promise<SceneAnalysis> - Combined analysis result
 * @throws Error if all retry attempts fail
 * 
 * @example
 * ```typescript
 * const analysis = await analyzePageSpreadWithRetry(
 *   pages[0].textContent,
 *   pages[1].textContent,
 *   1,
 *   3
 * );
 * ```
 */
export async function analyzePageSpreadWithRetry(
  page1Text: string,
  page2Text: string,
  startPageNumber: number,
  maxRetries: number = 3
): Promise<SceneAnalysis> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await analyzePageSpread(page1Text, page2Text, startPageNumber);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Unknown error during analysis");
      
      // Log the error for debugging
      console.error(
        `Page spread analysis attempt ${attempt + 1}/${maxRetries} failed for pages ${startPageNumber}-${startPageNumber + 1}:`,
        error
      );
      
      // Don't wait after the last attempt
      if (attempt < maxRetries - 1) {
        // Exponential backoff: 1s, 2s, 4s
        const delayMs = Math.pow(2, attempt) * 1000;
        console.log(`Retrying in ${delayMs}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  // All retries exhausted
  throw new Error(
    `Page spread analysis failed for pages ${startPageNumber}-${startPageNumber + 1} after ${maxRetries} attempts: ${lastError?.message || "Unknown error"}`
  );
}

/**
 * Batch analyze multiple pages with retry logic
 * 
 * Processes multiple pages sequentially with retry logic for each page.
 * Useful for background job processing where you need to analyze an entire book.
 * 
 * Note: This processes pages sequentially to avoid overwhelming the API.
 * For parallel processing, use Promise.all with rate limiting.
 * 
 * @param pages - Array of page objects with textContent and pageNumber
 * @param maxRetries - Maximum retry attempts per page (default: 3)
 * @returns Promise<SceneAnalysis[]> - Array of analysis results
 * @throws Error if any page fails after retries
 * 
 * @example
 * ```typescript
 * const pages = [
 *   { textContent: "...", pageNumber: 1 },
 *   { textContent: "...", pageNumber: 2 }
 * ];
 * const analyses = await batchAnalyzePages(pages);
 * ```
 */
export async function batchAnalyzePages(
  pages: Array<{ textContent: string; pageNumber: number }>,
  maxRetries: number = 3
): Promise<SceneAnalysis[]> {
  const results: SceneAnalysis[] = [];

  for (const page of pages) {
    try {
      const analysis = await analyzeWithRetry(
        page.textContent,
        page.pageNumber,
        maxRetries
      );
      results.push(analysis);
    } catch (error) {
      console.error(`Failed to analyze page ${page.pageNumber}:`, error);
      throw error; // Re-throw to stop batch processing on failure
    }
  }

  return results;
}

/**
 * Batch analyze page spreads with retry logic
 * 
 * Processes page spreads (2 pages at a time) sequentially with retry logic.
 * This is the recommended approach for book processing as it:
 * - Reduces API calls by 50%
 * - Provides better narrative context
 * - Aligns with the reading interface
 * 
 * @param pages - Array of page objects with textContent and pageNumber
 * @param maxRetries - Maximum retry attempts per spread (default: 3)
 * @returns Promise<SceneAnalysis[]> - Array of analysis results (one per spread)
 * 
 * @example
 * ```typescript
 * const pages = await prisma.page.findMany({
 *   where: { bookId },
 *   orderBy: { pageNumber: 'asc' }
 * });
 * const analyses = await batchAnalyzePageSpreads(pages);
 * ```
 */
export async function batchAnalyzePageSpreads(
  pages: Array<{ textContent: string; pageNumber: number }>,
  maxRetries: number = 3
): Promise<SceneAnalysis[]> {
  const results: SceneAnalysis[] = [];

  // Process pages in pairs (spreads)
  for (let i = 0; i < pages.length; i += 2) {
    const page1 = pages[i];
    const page2 = pages[i + 1];

    try {
      if (page2) {
        // Analyze as a spread
        const analysis = await analyzePageSpreadWithRetry(
          page1.textContent,
          page2.textContent,
          page1.pageNumber,
          maxRetries
        );
        results.push(analysis);
      } else {
        // Last page is odd, analyze alone
        const analysis = await analyzeWithRetry(
          page1.textContent,
          page1.pageNumber,
          maxRetries
        );
        results.push(analysis);
      }
    } catch (error) {
      console.error(
        `Failed to analyze page spread starting at ${page1.pageNumber}:`,
        error
      );
      throw error; // Re-throw to stop batch processing on failure
    }
  }

  return results;
}
