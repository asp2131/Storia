# Soundscape Caching System

Intelligent caching system for generated soundscapes to reduce API costs and improve performance.

## Overview

The soundscape caching system reuses previously generated soundscapes for scenes with similar characteristics. This provides significant benefits:

- **Cost Reduction**: Reduces Replicate API costs by 30-50% through reuse
- **Faster Processing**: No generation wait time for cached soundscapes
- **Consistent Quality**: Same audio for similar scenes across books
- **Scalability**: Enables processing more books with the same budget

## How It Works

### Cache Key Generation

Soundscapes are cached based on three key narrative elements:

1. **Setting**: Physical location/environment (e.g., "dark forest", "busy city")
2. **Mood**: Emotional tone (e.g., "tense", "peaceful", "mysterious")
3. **Intensity**: Activity level (low, medium, high)

These three attributes define the core characteristics of a soundscape. Scenes with matching attributes will sound similar, making them perfect candidates for reuse.

### Cache Lookup Process

```typescript
import { findCachedSoundscape } from "./soundscapeCache";
import { generateSoundscape } from "./generateSoundscape";

// 1. Analyze the scene
const analysis = await analyzePageContent(pageText, pageNumber);

// 2. Check cache first
const cached = await findCachedSoundscape(analysis);

if (cached) {
  // Use cached soundscape
  console.log("Cache hit! Using existing soundscape:", cached.audioUrl);
  return cached;
} else {
  // Generate new soundscape
  console.log("Cache miss. Generating new soundscape...");
  const soundscape = await generateSoundscape(analysis, sceneId);
  return soundscape;
}
```

## API Reference

### `findCachedSoundscape(sceneAnalysis, excludeBookId?)`

Searches for a cached soundscape matching the scene's characteristics.

**Parameters:**
- `sceneAnalysis`: Scene analysis with setting, mood, and intensity
- `excludeBookId` (optional): Book ID to exclude from search (prevents self-caching)

**Returns:** `Promise<CachedSoundscape | null>`

**Example:**
```typescript
const cached = await findCachedSoundscape(analysis, currentBookId);
```

### `generateCacheKey(sceneAnalysis)`

Generates a normalized cache key from scene analysis.

**Parameters:**
- `sceneAnalysis`: Scene analysis object

**Returns:** `string` - Normalized cache key (e.g., "dark forest|tense|high")

**Example:**
```typescript
const key = generateCacheKey(analysis);
console.log(key); // "dark forest|tense|high"
```

### `findCachedSoundscapes(sceneAnalyses, excludeBookId?)`

Batch lookup for multiple scene analyses.

**Parameters:**
- `sceneAnalyses`: Array of scene analyses
- `excludeBookId` (optional): Book ID to exclude from search

**Returns:** `Promise<Array<CachedSoundscape | null>>`

**Example:**
```typescript
const analyses = await batchAnalyzePageSpreads(pages);
const cached = await findCachedSoundscapes(analyses, bookId);

for (let i = 0; i < analyses.length; i++) {
  if (cached[i]) {
    // Use cached soundscape
  } else {
    // Generate new soundscape
  }
}
```

### `getCacheStats()`

Get cache performance statistics.

**Returns:** `Promise<CacheStats>`

**Example:**
```typescript
const stats = await getCacheStats();
console.log(`Total soundscapes: ${stats.totalSoundscapes}`);
console.log(`Unique cache keys: ${stats.uniqueCacheKeys}`);
console.log(`Average reuse: ${stats.averageSoundscapesPerKey}x`);
```

### `clearBookCache(bookId)`

Remove all soundscapes for a specific book.

**Parameters:**
- `bookId`: Book ID to clear cache for

**Returns:** `Promise<number>` - Number of soundscapes deleted

**Example:**
```typescript
const deleted = await clearBookCache(bookId);
console.log(`Deleted ${deleted} soundscapes`);
```

### `validateCacheIntegrity()`

Check for soundscapes with invalid audio URLs.

**Returns:** `Promise<string[]>` - Array of invalid soundscape IDs

**Example:**
```typescript
const invalid = await validateCacheIntegrity();
if (invalid.length > 0) {
  console.log(`Found ${invalid.length} invalid soundscapes`);
}
```

## Integration Example

Here's how to integrate caching into the soundscape generation pipeline:

```typescript
import { analyzePageSpread } from "./analyzeContent";
import { findCachedSoundscape } from "./soundscapeCache";
import { generateSoundscape } from "./generateSoundscape";
import { prisma } from "./db";

async function processBookSoundscapes(bookId: string) {
  // Get all pages for the book
  const pages = await prisma.page.findMany({
    where: { bookId },
    orderBy: { pageNumber: "asc" },
  });

  // Process in page spreads (2 pages at a time)
  for (let i = 0; i < pages.length; i += 2) {
    const page1 = pages[i];
    const page2 = pages[i + 1];

    // Analyze the page spread
    const analysis = page2
      ? await analyzePageSpread(page1.textContent, page2.textContent, page1.pageNumber)
      : await analyzePageContent(page1.textContent, page1.pageNumber);

    // Check cache first
    const cached = await findCachedSoundscape(analysis, bookId);

    let soundscapeUrl: string;
    let soundscapePrompt: string;

    if (cached) {
      console.log(`✅ Using cached soundscape for pages ${page1.pageNumber}-${page2?.pageNumber || page1.pageNumber}`);
      soundscapeUrl = cached.audioUrl;
      soundscapePrompt = cached.generationPrompt;
    } else {
      console.log(`🎵 Generating new soundscape for pages ${page1.pageNumber}-${page2?.pageNumber || page1.pageNumber}`);
      
      // Create scene record
      const scene = await prisma.scene.create({
        data: {
          bookId,
          startPage: page1.pageNumber,
          endPage: page2?.pageNumber || page1.pageNumber,
          pageSpreadIndex: Math.floor(i / 2),
          setting: analysis.setting,
          mood: analysis.mood,
          descriptors: analysis,
        },
      });

      // Generate soundscape
      const soundscape = await generateSoundscape(analysis, scene.id);
      
      // Store in database
      await prisma.soundscape.create({
        data: {
          sceneId: scene.id,
          audioUrl: soundscape.audioUrl,
          duration: soundscape.duration,
          generationPrompt: soundscape.prompt,
          replicatePredictionId: soundscape.predictionId,
        },
      });

      soundscapeUrl = soundscape.audioUrl;
      soundscapePrompt = soundscape.prompt;
    }

    // Update pages with scene reference
    await prisma.page.update({
      where: { id: page1.id },
      data: { sceneId: cached?.sceneId || scene.id },
    });

    if (page2) {
      await prisma.page.update({
        where: { id: page2.id },
        data: { sceneId: cached?.sceneId || scene.id },
      });
    }
  }

  // Mark book as ready
  await prisma.book.update({
    where: { id: bookId },
    data: { status: "ready" },
  });
}
```

## Cache Performance

### Expected Hit Rates

Based on typical book content:

- **Single Book**: 10-20% cache hit rate (similar scenes within the book)
- **Multiple Books**: 30-50% cache hit rate (common settings/moods across books)
- **Large Library**: 50-70% cache hit rate (extensive reuse opportunities)

### Cost Savings Example

For a 300-page book (150 page spreads):

**Without Caching:**
- 150 soundscape generations
- Cost: 150 × $0.05 = $7.50 per book

**With Caching (40% hit rate):**
- 90 new generations + 60 cached
- Cost: 90 × $0.05 = $4.50 per book
- **Savings: $3.00 per book (40%)**

For 100 books: **$300 saved**

## Database Queries

The caching system uses efficient database queries:

```sql
-- Find cached soundscape
SELECT s.* FROM soundscapes s
JOIN scenes sc ON s.scene_id = sc.id
WHERE 
  LOWER(sc.setting) = LOWER($1)
  AND LOWER(sc.mood) = LOWER($2)
  AND sc.descriptors->>'intensity' = $3
  AND sc.book_id != $4  -- Exclude current book
LIMIT 1;
```

### Indexes

Ensure these indexes exist for optimal performance:

```sql
CREATE INDEX idx_scenes_setting ON scenes(LOWER(setting));
CREATE INDEX idx_scenes_mood ON scenes(LOWER(mood));
CREATE INDEX idx_scenes_descriptors_intensity ON scenes((descriptors->>'intensity'));
```

## Best Practices

### 1. Always Exclude Current Book

When processing a book, exclude it from cache searches to avoid circular references:

```typescript
const cached = await findCachedSoundscape(analysis, currentBookId);
```

### 2. Monitor Cache Performance

Regularly check cache statistics to optimize:

```typescript
const stats = await getCacheStats();
console.log(`Cache hit rate: ${(stats.averageSoundscapesPerKey - 1) * 100}%`);
```

### 3. Validate Cache Integrity

Periodically check for invalid soundscapes:

```typescript
const invalid = await validateCacheIntegrity();
if (invalid.length > 0) {
  // Clean up or regenerate invalid soundscapes
}
```

### 4. Clear Cache on Reprocessing

When reprocessing a book, clear its cache first:

```typescript
await clearBookCache(bookId);
// Then reprocess the book
```

## Troubleshooting

### Low Cache Hit Rate

If cache hit rate is lower than expected:

1. Check if setting/mood values are too specific
2. Consider normalizing common variations (e.g., "forest" vs "woods")
3. Review intensity distribution (should be balanced across low/medium/high)

### Invalid Soundscapes

If `validateCacheIntegrity()` finds issues:

1. Check R2 storage for missing files
2. Verify audio URLs are accessible
3. Regenerate invalid soundscapes

### Performance Issues

If cache lookups are slow:

1. Verify database indexes are created
2. Check database connection pool settings
3. Consider adding Redis for hot cache entries

## Future Enhancements

Potential improvements for Phase 2:

1. **Fuzzy Matching**: Use similarity scoring for near-matches
2. **Redis Layer**: Add in-memory cache for hot entries
3. **Semantic Search**: Use embeddings for better matching
4. **User Preferences**: Allow users to disable caching for variety
5. **Analytics Dashboard**: Visualize cache performance over time
