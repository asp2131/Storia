# Soundscape Generation Background Job

This API endpoint processes a book's pages and generates AI-powered soundscapes with comprehensive error handling and progress tracking.

## Endpoint

```
POST /api/generate-soundscapes
```

## Request Body

```json
{
  "bookId": "uuid-of-book"
}
```

## Features

### 1. Progress Tracking

The job tracks and updates the book status throughout processing:

- **processing**: Job is actively running
- **ready**: Job completed successfully (with or without some errors)
- **failed**: Job failed completely or no spreads were processed

### 2. Error Handling

Comprehensive error handling at multiple levels:

#### Retry Logic
- **Content Analysis**: Max 3 attempts with exponential backoff (1s, 2s, 4s)
- **Soundscape Generation**: Max 3 attempts with exponential backoff (2s, 4s, 8s)
- **Database Operations**: Max 3 attempts with exponential backoff

#### Error Recovery
- Individual spread failures don't stop the entire job
- Soundscape generation failures are logged but processing continues
- Partial success is considered successful (status: "ready")

#### Error Storage
All errors are stored in the database with:
- Timestamp
- Spread index and page numbers
- Error type and message
- Stack trace (for debugging)
- Attempt number

### 3. Processing Strategy

The job processes pages in 2-page spreads:

1. **Analyze Content**: Extract narrative elements using Gemini API
2. **Detect Scene Changes**: Compare with previous spread
3. **Generate Soundscape**: Create audio for new scenes only
4. **Update Database**: Link pages to scenes and soundscapes

### 4. Graceful Degradation

The job continues processing even when errors occur:

- If content analysis fails → Skip spread, continue to next
- If soundscape generation fails → Log error, continue to next scene
- If database update fails → Retry 3 times, then continue

## Response Format

### Success (All Spreads Processed)

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

### Partial Success (Some Errors)

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
  "errors": [
    {
      "spreadIndex": 23,
      "pageNumbers": [47, 48],
      "errorMessage": "Gemini API rate limit exceeded"
    }
  ]
}
```

### Complete Failure

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
  "errors": [
    {
      "spreadIndex": 0,
      "pageNumbers": [1, 2],
      "errorMessage": "Gemini API authentication failed"
    }
  ]
}
```

## Error Types

### ValidationError
- Book not found
- Book has no pages
- Invalid request parameters

### ContentAnalysisError
- Gemini API failures
- Invalid response format
- Rate limiting

### SoundscapeGenerationError
- Replicate API failures
- Audio download failures
- R2 upload failures

### DatabaseError
- Connection failures
- Query timeouts
- Constraint violations

## Usage Example

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

## Performance Considerations

### Processing Time
- ~8-10 seconds per spread (analysis + generation)
- 300-page book (150 spreads) ≈ 20-25 minutes
- Actual time varies based on:
  - API response times
  - Scene change frequency
  - Network conditions

### Cost Estimation
- Gemini Flash: ~$0.015-0.10 per 300-page book
- Replicate (ElevenLabs): ~$0.05 per soundscape
- Total: ~$2-5 per 300-page book (assuming 40-50 scenes)

### Optimization Tips
1. Use page spread analysis (already implemented)
2. Cache similar soundscapes (see `lib/soundscapeCache.ts`)
3. Process books during off-peak hours
4. Consider batch processing multiple books

## Monitoring

### Logs
All processing steps are logged with emojis for easy scanning:
- 🚀 Job start
- 📖 Book info
- 📄 Spread processing
- ✅ Success steps
- ❌ Errors
- 📊 Final stats

### Database
Check `books.processing_errors` field for detailed error information:

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

## Requirements Satisfied

- **9.1**: Error handling with graceful degradation
- **9.2**: Retry logic with exponential backoff (max 3 attempts)
- **9.3**: Error details stored in database for debugging
- **3.3**: Scene detection every 2 pages
- **4.1**: Soundscape generation for new scenes
- **4.4**: Progress tracking and status updates
