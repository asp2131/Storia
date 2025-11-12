# Task 6 Progress: AI Scene Classification & Soundscape Generation

## Status: In Progress (6.1 ✅, 6.2 ✅, 6.3 🔄, 6.4 ⏳)

## Key Architecture Change

**Original Plan**: Map scenes to curated soundscape library  
**Updated Plan**: Generate custom soundscapes using AI (sepal/audiogen on Replicate)

This provides:
- Unique, contextual audio for each scene
- No need to maintain a curated library
- Better matching to book content
- More scalable approach

## Completed Work

### 6.1 Replicate API Client ✅

**File**: `lib/storia/ai/replicate_client.ex`

**Features**:
- Support for both Gemini Flash (text) and AudioGen (audio) models
- `create_prediction/2` - Create text predictions with Gemini
- `create_audio_prediction/2` - Generate audio with AudioGen
- `get_prediction/1` - Retrieve prediction status
- `poll_prediction/2` - Poll until completion with exponential backoff
- Automatic retry logic for network/server errors (3 attempts)
- Comprehensive error handling

**AudioGen Parameters**:
```elixir
create_audio_prediction(prompt,
  duration: 10,              # 1-30 seconds
  temperature: 1.0,          # 0.0-2.0
  top_k: 250,                # sampling parameter
  top_p: 0,                  # cumulative probability
  classifier_free_guidance: 3,
  output_format: "mp3"       # or "wav"
)
```

### 6.2 SceneClassifier Module ✅

**File**: `lib/storia/ai/scene_classifier.ex`

**Features**:
- `classify_page/1` - Analyze page text and extract descriptors
- `detect_scene_boundaries/1` - Find scene transitions using similarity
- `create_scenes/3` - Group pages into scenes with aggregated descriptors

**Scene Descriptors**:
- `mood`: emotional tone (joyful, tense, melancholic, etc.)
- `setting`: location type (indoor, outdoor, urban, rural, nature)
- `time_of_day`: morning, afternoon, evening, night
- `weather`: sunny, rainy, stormy, cloudy, snowy
- `activity_level`: calm, moderate, high, intense
- `atmosphere`: suspenseful, romantic, adventurous, contemplative

**Scene Boundary Detection**:
- Compares consecutive pages using descriptor similarity
- Threshold: 0.6 (new scene when similarity < 0.6)
- Aggregates descriptors within scenes (most common values)

### 6.3 SoundscapeGenerator Module ✅

**File**: `lib/storia/ai/soundscape_generator.ex`

**Features**:
- `generate_soundscape/2` - Full pipeline for audio generation
- `generate_prompt_from_descriptors/1` - Convert descriptors to AudioGen prompts
- Automatic download and upload to R2 storage
- Database record creation with metadata

**Example Prompt Generation**:
```elixir
descriptors = %{
  "mood" => "tense",
  "setting" => "indoor",
  "time_of_day" => "night",
  "weather" => "stormy",
  "activity_level" => "high",
  "atmosphere" => "suspenseful"
}

# Generates:
"Tense and suspenseful indoor soundscape at night with stormy weather high activity"
```

## Database Changes

### New Migrations

1. **`20251112200000_add_generation_prompt_to_soundscapes.exs`**
   - Added `generation_prompt` text field
   - Changed `tags` from map to array of strings
   - Updated `source_type` to support "ai_generated"

2. **`20251112200001_add_scene_number_to_scenes.exs`**
   - Added `scene_number` integer field
   - Added index on `(book_id, scene_number)`

### Updated Schemas

**Scene** (`lib/storia/content/scene.ex`):
- Added `scene_number` field
- Updated descriptor validation to match classifier output

**Soundscape** (`lib/storia/soundscapes/soundscape.ex`):
- Added `generation_prompt` field
- Changed `tags` from map to array
- Updated `source_type` validation to include "ai_generated"

## Files Created

1. `lib/storia/ai/replicate_client.ex` - Replicate API integration
2. `lib/storia/ai/scene_classifier.ex` - Scene analysis and classification
3. `lib/storia/ai/soundscape_generator.ex` - AI audio generation
4. `priv/repo/migrations/20251112200000_add_generation_prompt_to_soundscapes.exs`
5. `priv/repo/migrations/20251112200001_add_scene_number_to_scenes.exs`

## Files Modified

1. `.kiro/specs/storia-mvp-core/tasks.md` - Updated Task 6 & 7 descriptions
2. `lib/storia/content/scene.ex` - Added scene_number, updated validations
3. `lib/storia/soundscapes/soundscape.ex` - Added generation_prompt, changed tags

## Next Steps

### 6.3 SceneAnalyzer Oban Worker (In Progress)
- Create worker to process all pages in a book
- Classify each page with Gemini
- Detect scene boundaries
- Create scene records
- Calculate processing costs
- Enqueue SoundscapeGenerator worker

### 6.4 Test Scene Classification (Pending)
- Mock Replicate API responses
- Test scene boundary detection
- Test error handling
- Integration tests

### Task 7: Soundscape Generation Worker (Pending)
- Create SoundscapeGenerator Oban worker
- Generate audio for all scenes
- Upload to R2 storage
- Handle errors and retries
- Update book status to "ready_for_review"

## API Keys Required

Add to `.env`:
```bash
REPLICATE_API_KEY=your_replicate_api_key
```

Get your key at: https://replicate.com/account/api-tokens

## Processing Pipeline

```
Book Upload
    ↓
PDFProcessor (Task 5) ✅
    ↓
SceneAnalyzer (Task 6.3) 🔄
    ├─ Classify pages with Gemini
    ├─ Detect scene boundaries
    └─ Create scene records
    ↓
SoundscapeGenerator (Task 7) ⏳
    ├─ Generate prompts from descriptors
    ├─ Create audio with AudioGen
    ├─ Upload to R2
    └─ Store soundscape records
    ↓
Admin Review (Task 8) ⏳
    ↓
Published Book
```

## Cost Considerations

**Gemini Flash**:
- ~$0.000075 per 1K input tokens
- ~$0.0003 per 1K output tokens
- Estimate: $0.01-0.05 per book (depending on length)

**AudioGen**:
- ~$0.0023 per second of audio
- 10 seconds per scene
- Estimate: $0.023 per scene
- For a 150-page book with ~15 scenes: ~$0.35

**Total per book**: ~$0.40-0.50

## Testing Strategy

1. **Unit Tests**: Mock Replicate API responses
2. **Integration Tests**: Use test API keys with small samples
3. **Manual Testing**: Process sample public domain books
4. **Cost Tracking**: Monitor actual API costs during testing

---

**Last Updated**: November 12, 2025  
**Status**: 6.1 & 6.2 Complete, 6.3 In Progress
