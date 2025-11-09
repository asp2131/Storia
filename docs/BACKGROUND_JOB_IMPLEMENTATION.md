# Background Job Implementation Guide

## Overview

This document describes the implementation of the soundscape generation background job with comprehensive error handling and progress tracking.

## Implementation Summary

### 1. Database Schema Changes

Added `processingErrors` field to the `Book` model to store error details:

```prisma
model Book {
  // ... existing fields
  processingErrors Json? @map("processing_errors") // Array of error details for debugging
}
```

**Migration**: `20251109162438_add_processing_errors_to_books`

### 2. API Endpoint

**Location**: `app/api/generate-soundscapes/route.ts`

**Method**: POST

**Request Body**:
```json
{
  "bookId": "uuid-of-book"
}
```

### 3. Key Features Implemented

#### Progress Tracking
- Updates book status throughout processing: `processing` → `ready` or `failed`
- Tracks statistics: spreads processed, scenes created, soundscapes generated
- Stores processing time for performance monitoring

#### Error Handling
- **Retry Logic**: Max 3 attempts with exponential backoff for:
  - Content analysis (Gemini API)
  - Soundscape generation (Replicate API)
  - Database operations
  
- **Graceful Degradation**: 
  - Individual spread failures don't stop the entire job
  - Soundscape generation failures are logged but processing continues
  - Partial success is considered successful (status: "ready")

- **Error Storage**:
  - All errors stored in `books.processing_errors` JSON field
  - Includes: timestamp, spread index, page numbers, error type, message, stack trace

#### Processing Strategy
1. Process pages in 2-page spreads (aligns with react-pageflip)
2. Analyze content using Gemini API with retry logic
3. Detect scene changes by comparing with previous spread
4. Generate soundscapes only for new scenes
5. Update database with scene and soundscape references
6. Continue processing even when individual spreads fail

### 4. Error Types Handled

- **ValidationError**: Invalid input, missing data
- **ContentAnalysisError**: Gemini API failures, rate limiting
- **SoundscapeGenerationError**: Replicate API failures, audio processing errors
- **DatabaseError**: Connection issues, query failures

### 5. Response Formats

#### Complete Success
```json
{
  "success": true,
  "bookId": "uuid",
  "status": "ready",
  "stats": {
    "totalSpreads": 150,
    "processedSpreads": 150,
    "scenesCreated": 45,
    "soundscapesGenerated": 45,
    "processingTimeSeconds": 1234.56
  }
}
```

#### Partial Success (Some Errors)
```json
{
  "success": true,
  "bookId": "uuid",
  "status": "ready",
  "warning": "Some spreads failed to process",
  "stats": {
    "totalSpreads": 150,
    "processedSpreads": 145,
    "scenesCreated": 43,
    "soundscapesGenerated": 40,
    "errorCount": 5,
    "processingTimeSeconds": 1234.56
  },
  "errors": [...]
}
```

#### Complete Failure
```json
{
  "success": false,
  "bookId": "uuid",
  "status": "failed",
  "error": "All spreads failed to process",
  "stats": {
    "totalSpreads": 150,
    "errorCount": 150,
    "processingTimeSeconds": 123.45
  },
  "errors": [...]
}
```

## Usage

### Trigger Job After Upload

```typescript
// In upload endpoint
const book = await db.book.create({
  data: { /* ... */ }
});

// Trigger background job (fire and forget)
fetch('/api/generate-soundscapes', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ bookId: book.id })
}).catch(console.error);
```

### Check Processing Status

```typescript
const book = await db.book.findUnique({
  where: { id: bookId },
  select: {
    status: true,
    processingErrors: true,
    updatedAt: true
  }
});

if (book.status === 'failed' && book.processingErrors) {
  console.log('Processing errors:', book.processingErrors);
}
```

## Testing

Test script available at: `scripts/test-generate-soundscapes-job.ts`

```bash
npx tsx scripts/test-generate-soundscapes-job.ts
```

## Monitoring

### Logs
All processing steps are logged with emojis for easy scanning:
- 🚀 Job start
- 📖 Book info
- 📄 Spread processing
- ✅ Success steps
- ❌ Errors
- 📊 Final stats

### Database Queries

Check failed books:
```sql
SELECT 
  id, 
  title, 
  status, 
  processing_errors,
  updated_at
FROM books
WHERE status = 'failed'
ORDER BY updated_at DESC;
```

Check books with partial errors:
```sql
SELECT 
  id, 
  title, 
  status, 
  processing_errors
FROM books
WHERE status = 'ready' 
  AND processing_errors IS NOT NULL
ORDER BY updated_at DESC;
```

## Requirements Satisfied

- ✅ **9.1**: Error handling with graceful degradation
- ✅ **9.2**: Retry logic with exponential backoff (max 3 attempts)
- ✅ **9.3**: Error details stored in database for debugging
- ✅ **3.3**: Scene detection every 2 pages
- ✅ **4.1**: Soundscape generation for new scenes
- ✅ **4.4**: Progress tracking and status updates

## Performance Considerations

### Processing Time
- ~8-10 seconds per spread (analysis + generation)
- 300-page book (150 spreads) ≈ 20-25 minutes
- Actual time varies based on API response times and scene change frequency

### Cost Estimation
- Gemini Flash: ~$0.015-0.10 per 300-page book
- Replicate (ElevenLabs): ~$0.05 per soundscape
- Total: ~$2-5 per 300-page book (assuming 40-50 scenes)

## Future Enhancements

1. **Job Queue**: Replace with proper job queue (BullMQ, Inngest) for production
2. **Progress Updates**: Real-time progress updates via WebSocket
3. **Retry Strategies**: Configurable retry strategies per error type
4. **Batch Processing**: Process multiple books in parallel with rate limiting
5. **Cost Tracking**: Track actual API costs per book
6. **Performance Metrics**: Detailed timing metrics for each processing step
