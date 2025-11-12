# Task 6 Complete: AI Scene Classification & Soundscape Generation ✅

## Status: **COMPLETE** (All 4 subtasks ✅)

**Completion Date**: November 12, 2025

---

## Summary

Task 6 successfully implements the AI-powered scene classification and soundscape generation infrastructure for Storia. The system uses Gemini Flash for text analysis and AudioGen for custom audio generation, creating a fully automated pipeline from book pages to immersive soundscapes.

## Completed Subtasks

### ✅ 6.1 Replicate API Client
**File**: `lib/storia/ai/replicate_client.ex`

**Features**:
- Unified client for both Gemini Flash (text) and AudioGen (audio) models
- `create_prediction/2` - Text classification with Gemini
- `create_audio_prediction/2` - Audio generation with AudioGen  
- `get_prediction/1` - Retrieve prediction status
- `poll_prediction/2` - Automatic polling with exponential backoff
- Retry logic: 3 attempts with exponential backoff (1s, 2s, 4s)
- Comprehensive error handling for network, client, and server errors

**API Models**:
- **Gemini Flash**: `google/gemini-2.5-flash`
- **AudioGen**: `sepal/audiogen:154b3e5141493cb1b8cec976d9aa90f2b691137e39ad906d2421b74c2a8c52b8`

### ✅ 6.2 SceneClassifier Module
**File**: `lib/storia/ai/scene_classifier.ex`

**Features**:
- `classify_page/1` - AI-powered page analysis
- `detect_scene_boundaries/1` - Similarity-based boundary detection
- `create_scenes/3` - Scene creation with descriptor aggregation

**Scene Descriptors** (6 attributes):
1. **mood**: emotional tone (joyful, tense, melancholic, peaceful, mysterious)
2. **setting**: location type (indoor, outdoor, urban, rural, nature)
3. **time_of_day**: temporal context (morning, afternoon, evening, night)
4. **weather**: atmospheric conditions (sunny, rainy, stormy, cloudy, snowy)
5. **activity_level**: action pace (calm, moderate, high, intense)
6. **atmosphere**: overall feeling (suspenseful, romantic, adventurous, contemplative)

**Boundary Detection Algorithm**:
- Compares consecutive pages using descriptor similarity
- Similarity threshold: 0.6 (new scene when < 0.6)
- Aggregates descriptors within scenes using most common values

### ✅ 6.3 SceneAnalyzer Oban Worker
**File**: `lib/storia/workers/scene_analyzer.ex`

**Features**:
- Orchestrates complete scene analysis pipeline
- Processes all pages in a book sequentially
- Classifies each page with Gemini Flash (with retry logic)
- Detects scene boundaries automatically
- Creates scene records with aggregated descriptors
- Calculates and stores processing costs
- Updates book status through pipeline
- Enqueues SoundscapeGenerator worker on completion

**Processing Flow**:
1. Fetch book and validate pages exist
2. Update status to "analyzing"
3. Classify all pages (with fallback to defaults on failure)
4. Detect scene boundaries
5. Create scene records
6. Calculate and store costs
7. Update status to "mapping"
8. Enqueue SoundscapeGenerator

**Error Handling**:
- 3 retry attempts per page classification
- Fallback to default descriptors on failure
- Comprehensive error logging
- Updates book status to "failed" with error message

### ✅ 6.4 Tests
**Files**: 
- `test/storia/ai/scene_classifier_test.exs`
- `test/storia/ai/soundscape_generator_test.exs`

**Test Coverage**:
- Scene boundary detection with various descriptor patterns
- Scene creation from pages and boundaries
- Prompt generation from descriptors
- Integration tests for API calls (tagged, requires API key)
- Error handling scenarios

**Test Results**: ✅ All tests passing

## Additional Components Created

### SoundscapeGenerator Module (Bonus - for Task 7)
**File**: `lib/storia/ai/soundscape_generator.ex`

**Features**:
- `generate_soundscape/2` - Complete audio generation pipeline
- `generate_prompt_from_descriptors/1` - Natural language prompt creation
- Automatic download from Replicate
- Upload to R2 storage
- Database record creation

**Example Prompt**:
```
Input descriptors:
{
  "mood" => "tense",
  "setting" => "indoor",
  "time_of_day" => "night",
  "weather" => "stormy",
  "activity_level" => "high",
  "atmosphere" => "suspenseful"
}

Generated prompt:
"Tense and suspenseful indoor soundscape at night with stormy weather high activity"
```

## Database Changes

### New Migrations

1. **`20251112200000_add_generation_prompt_to_soundscapes.exs`**
   - Added `generation_prompt` text field for storing AudioGen prompts
   - Changed `tags` from map to array of strings
   - Updated `source_type` constraint to support "ai_generated"

2. **`20251112200001_add_scene_number_to_scenes.exs`**
   - Added `scene_number` integer field for sequential ordering
   - Added composite index on `(book_id, scene_number)`

### Updated Schemas

**Scene** (`lib/storia/content/scene.ex`):
- Added `scene_number` field
- Updated descriptor validation keys to match classifier output
- Valid keys: setting, mood, weather, time_of_day, activity_level, atmosphere

**Soundscape** (`lib/storia/soundscapes/soundscape.ex`):
- Added `generation_prompt` field
- Changed `tags` from map to array
- Updated `source_type` to include "ai_generated"

## Files Created (9)

1. `lib/storia/ai/replicate_client.ex` - Replicate API integration
2. `lib/storia/ai/scene_classifier.ex` - Scene analysis and classification
3. `lib/storia/ai/soundscape_generator.ex` - AI audio generation
4. `lib/storia/workers/scene_analyzer.ex` - Scene analysis Oban worker
5. `test/storia/ai/scene_classifier_test.exs` - Scene classifier tests
6. `test/storia/ai/soundscape_generator_test.exs` - Soundscape generator tests
7. `priv/repo/migrations/20251112200000_add_generation_prompt_to_soundscapes.exs`
8. `priv/repo/migrations/20251112200001_add_scene_number_to_scenes.exs`
9. `docs/task6_progress.md` - Progress documentation

## Files Modified (4)

1. `.kiro/specs/storia-mvp-core/tasks.md` - Marked Task 6 complete
2. `lib/storia/content/scene.ex` - Added scene_number, updated validations
3. `lib/storia/soundscapes/soundscape.ex` - Added generation_prompt
4. `lib/storia/workers/pdf_processor.ex` - Enqueue SceneAnalyzer

## Complete Processing Pipeline

```
📚 Book Upload
    ↓
📄 PDFProcessor (Task 5) ✅
    ├─ Extract text from PDF
    ├─ Create page records
    └─ Status: "pending" → "extracting" → "analyzing"
    ↓
🤖 SceneAnalyzer (Task 6) ✅
    ├─ Classify pages with Gemini Flash
    ├─ Detect scene boundaries
    ├─ Create scene records
    ├─ Calculate costs
    └─ Status: "analyzing" → "mapping"
    ↓
🎵 SoundscapeGenerator (Task 7) ⏳
    ├─ Generate prompts from descriptors
    ├─ Create audio with AudioGen
    ├─ Upload to R2
    ├─ Store soundscape records
    └─ Status: "mapping" → "ready_for_review"
    ↓
👤 Admin Review (Task 8) ⏳
    ↓
✅ Published Book
```

## Cost Estimates

### Per Book Processing

**Gemini Flash Classification**:
- Input: ~500 tokens per page
- Output: ~100 tokens per page
- Cost: ~$0.000075 per 1K input + ~$0.0003 per 1K output
- **Estimate**: $0.01-0.05 per book (150 pages)

**AudioGen Generation** (Task 7):
- ~$0.0023 per second of audio
- 10 seconds per scene
- **Estimate**: $0.023 per scene
- For 15 scenes: ~$0.35

**Total per book**: ~$0.40-0.50

## Environment Configuration

Required environment variables in `.env`:

```bash
# Replicate API
REPLICATE_API_KEY=your_replicate_api_key

# Cloudflare R2 (for audio storage)
R2_ACCESS_KEY_ID=your_r2_access_key_id
R2_SECRET_ACCESS_KEY=your_r2_secret_access_key
R2_ACCOUNT_ID=your_r2_account_id
R2_BUCKET_NAME=storia-production
R2_ENDPOINT=your_account_id.r2.cloudflarestorage.com
```

Get Replicate API key: https://replicate.com/account/api-tokens

## Testing

### Run Unit Tests
```bash
# All tests (excluding integration)
mix test test/storia/ai/ --exclude integration

# Scene classifier tests
mix test test/storia/ai/scene_classifier_test.exs

# Soundscape generator tests
mix test test/storia/ai/soundscape_generator_test.exs
```

### Run Integration Tests
```bash
# Requires REPLICATE_API_KEY and R2 credentials
mix test test/storia/ai/ --only integration
```

## Usage Example

```elixir
# After PDFProcessor completes, SceneAnalyzer is automatically enqueued

# Manual enqueue (for testing):
%{book_id: book_id}
|> Storia.Workers.SceneAnalyzer.new()
|> Oban.insert()

# Check progress:
book = Storia.Content.get_book!(book_id)
IO.inspect(book.processing_status)  # "analyzing" → "mapping"

# View created scenes:
scenes = Storia.Repo.all(
  from s in Storia.Content.Scene,
  where: s.book_id == ^book_id,
  order_by: s.scene_number
)

Enum.each(scenes, fn scene ->
  IO.puts("Scene #{scene.scene_number}: Pages #{scene.start_page}-#{scene.end_page}")
  IO.inspect(scene.descriptors)
end)
```

## Next Steps

### Task 7: Build AI Soundscape Generation System ⏳

**Remaining Work**:
- 7.3: Create SoundscapeGenerator Oban worker
- 7.4: Test soundscape generation pipeline

**Note**: SoundscapeGenerator module (7.1) and audio storage integration (7.2) are already complete!

### Task 8: Create Admin Interface ⏳
- Admin authentication and authorization
- Book list and upload interface
- Scene review with audio preview
- Soundscape library management
- Publish functionality

## Key Achievements

✅ **Unified AI Infrastructure**: Single client for both text and audio AI models  
✅ **Intelligent Scene Detection**: Automatic boundary detection with similarity algorithm  
✅ **Robust Error Handling**: Retry logic, fallbacks, and comprehensive logging  
✅ **Cost Tracking**: Automatic calculation and storage of processing costs  
✅ **Scalable Architecture**: Oban-based job processing with proper queue management  
✅ **Comprehensive Testing**: Unit and integration tests with proper mocking  
✅ **Production Ready**: Database migrations, schema validations, and error recovery  

## Architecture Highlights

### Design Decisions

1. **AI-Generated vs Curated**: Chose AI generation for infinite scalability and perfect context matching
2. **Similarity Threshold**: 0.6 provides good balance between scene granularity and coherence
3. **Fallback Descriptors**: Ensures pipeline continues even if some classifications fail
4. **Retry Logic**: 3 attempts with exponential backoff balances reliability and speed
5. **Cost Tracking**: Enables monitoring and optimization of AI usage

### Performance Considerations

- **Concurrency**: 5 concurrent AI analysis jobs (configured in Oban)
- **Polling**: Exponential backoff prevents API rate limiting
- **Batch Operations**: Scene creation uses transactions for atomicity
- **Memory**: Processes pages sequentially to manage memory usage

---

**Task 6 Status**: ✅ **COMPLETE**  
**All Tests**: ✅ **PASSING**  
**Migrations**: ✅ **APPLIED**  
**Documentation**: ✅ **COMPLETE**  
**Ready for**: Task 7 (Soundscape Generation Worker)
