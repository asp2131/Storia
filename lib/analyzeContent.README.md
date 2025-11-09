# Content Analysis Module

This module provides high-level content analysis functionality for the Immersive Reading Platform. It wraps the Gemini API client with additional features like retry logic, batch processing, and page spread analysis.

## Overview

The Content Analysis Module analyzes book page content to extract narrative elements for soundscape generation. It's designed to work seamlessly with the reading interface's page-flip functionality.

## Features

- ✅ Single page analysis
- ✅ Page spread analysis (2 pages at once)
- ✅ Automatic retry with exponential backoff
- ✅ Batch processing for multiple pages
- ✅ Comprehensive error handling
- ✅ Full TypeScript support

## Quick Start

```typescript
import { analyzePageContent, analyzePageSpread } from "@/lib/analyzeContent";

// Analyze a single page
const analysis = await analyzePageContent(pageText, pageNumber);

// Analyze a page spread (recommended)
const spreadAnalysis = await analyzePageSpread(page1Text, page2Text, startPage);
```

## API Reference

### `analyzePageContent(pageText, pageNumber)`

Analyzes a single page of content.

**Parameters:**
- `pageText` (string): The text content to analyze
- `pageNumber` (number): The page number for context

**Returns:** `Promise<SceneAnalysis>`

**Example:**
```typescript
const analysis = await analyzePageContent(
  "The dark forest loomed ahead...",
  42
);
console.log(analysis.setting);      // "A dark forest"
console.log(analysis.mood);         // "tense"
console.log(analysis.intensity);    // "high"
console.log(analysis.audioPrompt);  // "Rustling leaves and distant howls..."
```

### `analyzePageSpread(page1Text, page2Text, startPageNumber)`

Analyzes a 2-page spread as a single unit. **This is the recommended approach** for the reading platform.

**Why use page spreads?**
- Reduces API calls by 50%
- Aligns with react-pageflip page turns
- Provides better narrative context
- Ensures soundscape transitions match visual page flips

**Parameters:**
- `page1Text` (string): Text content of the first page
- `page2Text` (string): Text content of the second page
- `startPageNumber` (number): Page number of the first page

**Returns:** `Promise<SceneAnalysis>`

**Example:**
```typescript
const analysis = await analyzePageSpread(
  pages[0].textContent,
  pages[1].textContent,
  1
);
```

### `analyzeWithRetry(pageText, pageNumber, maxRetries)`

Analyzes a page with automatic retry logic and exponential backoff.

**Parameters:**
- `pageText` (string): The text content to analyze
- `pageNumber` (number): The page number for context
- `maxRetries` (number, optional): Maximum retry attempts (default: 3)

**Returns:** `Promise<SceneAnalysis>`

**Retry Strategy:**
- Attempt 1: Immediate
- Attempt 2: 1 second delay
- Attempt 3: 2 second delay
- Attempt 4: 4 second delay

**Example:**
```typescript
try {
  const analysis = await analyzeWithRetry(pageText, 1, 3);
} catch (error) {
  console.error("Analysis failed after 3 retries:", error);
}
```

### `analyzePageSpreadWithRetry(page1Text, page2Text, startPageNumber, maxRetries)`

Analyzes a page spread with automatic retry logic. **Recommended for production use.**

**Parameters:**
- `page1Text` (string): Text content of the first page
- `page2Text` (string): Text content of the second page
- `startPageNumber` (number): Page number of the first page
- `maxRetries` (number, optional): Maximum retry attempts (default: 3)

**Returns:** `Promise<SceneAnalysis>`

**Example:**
```typescript
const analysis = await analyzePageSpreadWithRetry(
  pages[0].textContent,
  pages[1].textContent,
  1,
  3
);
```

### `batchAnalyzePages(pages, maxRetries)`

Processes multiple pages sequentially with retry logic for each page.

**Parameters:**
- `pages` (Array): Array of `{ textContent: string, pageNumber: number }`
- `maxRetries` (number, optional): Maximum retry attempts per page (default: 3)

**Returns:** `Promise<SceneAnalysis[]>`

**Example:**
```typescript
const pages = [
  { textContent: "...", pageNumber: 1 },
  { textContent: "...", pageNumber: 2 }
];
const analyses = await batchAnalyzePages(pages);
```

### `batchAnalyzePageSpreads(pages, maxRetries)`

Processes page spreads (2 pages at a time) sequentially with retry logic. **Recommended for book processing.**

**Parameters:**
- `pages` (Array): Array of `{ textContent: string, pageNumber: number }`
- `maxRetries` (number, optional): Maximum retry attempts per spread (default: 3)

**Returns:** `Promise<SceneAnalysis[]>` - One analysis per spread

**Example:**
```typescript
const pages = await prisma.page.findMany({
  where: { bookId },
  orderBy: { pageNumber: 'asc' }
});
const analyses = await batchAnalyzePageSpreads(pages);
```

## SceneAnalysis Type

```typescript
interface SceneAnalysis {
  setting: string;              // Physical location/environment
  mood: string;                 // Emotional tone
  weather?: string;             // Weather conditions (if mentioned)
  timeOfDay?: string;           // Time context (if mentioned)
  intensity: "low" | "medium" | "high";  // Narrative intensity
  actions: string[];            // Key events and character actions
  audioPrompt: string;          // Description for soundscape generation
}
```

## Error Handling

The module includes comprehensive error handling:

- **Empty text validation**: Throws error if page text is empty
- **API failures**: Automatically retries with exponential backoff
- **Network errors**: Handled gracefully with descriptive messages
- **Batch processing**: Stops on first failure to prevent partial results

All errors include context (page number, attempt count) for debugging.

## Testing

Run the test script to verify the module:

```bash
npx tsx scripts/test-analyze-content.ts
```

The test suite covers:
- ✅ Single page analysis
- ✅ Page spread analysis
- ✅ Retry logic
- ✅ Page spread retry logic
- ✅ Error handling

## Integration Points

This module is used by:

1. **Background Jobs** (`app/api/generate-soundscapes/route.ts`) - Batch processing books
2. **Scene Detection** (`lib/sceneDetection.ts`) - Detecting scene changes
3. **Real-time Analysis** - On-demand page analysis

## Best Practices

### For Book Processing (Background Jobs)

Use `batchAnalyzePageSpreads()` for efficient processing:

```typescript
const pages = await prisma.page.findMany({
  where: { bookId },
  orderBy: { pageNumber: 'asc' }
});

const analyses = await batchAnalyzePageSpreads(pages, 3);
```

### For Real-time Analysis

Use `analyzePageSpreadWithRetry()` for robust single-spread analysis:

```typescript
const analysis = await analyzePageSpreadWithRetry(
  currentPage.textContent,
  nextPage.textContent,
  currentPage.pageNumber,
  3
);
```

### Error Handling

Always wrap analysis calls in try-catch blocks:

```typescript
try {
  const analysis = await analyzePageSpreadWithRetry(page1, page2, 1);
  // Process analysis...
} catch (error) {
  console.error("Analysis failed:", error);
  // Handle failure (skip page, use default, notify user, etc.)
}
```

## Performance Considerations

- **API Calls**: Page spread analysis reduces calls by 50%
- **Cost**: ~$0.015-0.10 per 300-page book with Gemini Flash
- **Speed**: 1-3 seconds per page spread
- **Concurrency**: Process sequentially to avoid rate limits
- **Retry Logic**: Adds 1-7 seconds on failures (exponential backoff)

## Requirements Coverage

This module satisfies the following requirements:

- ✅ **3.1**: Identifies setting, mood, weather, time of day, and character actions using Gemini Flash
- ✅ **3.2**: Generates detailed audio generation prompts
- ✅ **3.4**: Classifies intensity level as low, medium, or high

## Next Steps

After implementing this module, the next task is:

**Task 12**: Implement scene detection logic (`lib/sceneDetection.ts`)
- Compare analyses to detect scene changes
- Determine when new soundscapes are needed
- Integrate with page spread processing

## Related Documentation

- [Gemini API Client](./gemini.README.md) - Low-level Gemini integration
- [Design Document](../.kiro/specs/immersive-reading-platform/design.md) - Architecture overview
- [Requirements](../.kiro/specs/immersive-reading-platform/requirements.md) - Detailed requirements
