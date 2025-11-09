# Gemini API Client

This module provides integration with Google's Gemini 2.5 Flash model via the Replicate API for content analysis and scene detection.

## Overview

The Gemini client analyzes book page content to extract narrative elements that are used to generate contextually appropriate soundscapes. It identifies:

- **Setting**: Physical location/environment
- **Mood**: Emotional tone (tense, peaceful, mysterious, etc.)
- **Weather**: Weather conditions if mentioned
- **Time of Day**: Time context if mentioned
- **Intensity**: Narrative intensity (low, medium, high)
- **Actions**: Key events and character actions
- **Audio Prompt**: Description for soundscape generation

## Configuration

### Environment Variables

```env
REPLICATE_API_TOKEN=r8_your_token_here
```

Get your token from: https://replicate.com/account/api-tokens

### Model

Uses `google/gemini-2.5-flash` via Replicate API for:
- Fast response times
- Cost-effective analysis (~$0.015-0.10 per 300-page book)
- High-quality narrative understanding

## Usage

### Basic Analysis

```typescript
import { analyzePageContent } from "@/lib/gemini";

const analysis = await analyzePageContent(pageText, pageNumber);

console.log(analysis.setting);      // "A dark forest at night"
console.log(analysis.mood);         // "tense"
console.log(analysis.intensity);    // "high"
console.log(analysis.audioPrompt);  // "Rustling leaves and distant howls..."
```

### Page Spread Analysis

Analyze 2 pages together (recommended for page-flip synchronization):

```typescript
import { analyzePageSpread } from "@/lib/gemini";

const analysis = await analyzePageSpread(
  page1Text,
  page2Text,
  startPageNumber
);
```

### With Retry Logic

Automatically retry failed requests with exponential backoff:

```typescript
import { analyzeWithRetry } from "@/lib/gemini";

const analysis = await analyzeWithRetry(
  pageText,
  pageNumber,
  3 // max retries
);
```

## Response Format

```typescript
interface SceneAnalysis {
  setting: string;
  mood: string;
  weather?: string;
  timeOfDay?: string;
  intensity: "low" | "medium" | "high";
  actions: string[];
  audioPrompt: string;
}
```

## Error Handling

The client includes comprehensive error handling:

- Missing API token
- Empty page text
- Invalid JSON responses
- API failures
- Network errors

All errors are thrown with descriptive messages for debugging.

## Testing

Run the test script to verify the integration:

```bash
npx tsx scripts/test-gemini.ts
```

## Cost Optimization

- Gemini Flash is ~10-15x cheaper than Claude
- Analyzing every 2 pages reduces API calls by 50%
- Estimated cost: $0.015-0.10 per 300-page book
- Batch processing reduces overhead

## Performance

- Average response time: 1-3 seconds per page spread
- Supports concurrent requests
- Automatic retry with exponential backoff
- Rate limiting handled by Replicate

## Integration Points

This module is used by:

1. **Content Analysis Module** (`lib/analyzeContent.ts`) - Scene detection
2. **Background Jobs** (`app/api/generate-soundscapes/route.ts`) - Batch processing
3. **Scene Detection** (`lib/sceneDetection.ts`) - Scene change detection

## Future Enhancements

- Batch processing multiple page spreads in single request
- Caching analysis results for similar content
- Custom prompt templates for different genres
- Multi-language support
- Fine-tuned models for specific book types
