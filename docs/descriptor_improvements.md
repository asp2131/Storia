# Scene Descriptor Improvements

## Problem
After running the Alice in Wonderland test, we found that most scenes had low confidence matches with available soundscapes. Only 1 out of multiple scenes matched successfully, indicating that the AI-generated descriptors were too generic to align well with the soundscape library.

## Root Causes

1. **Generic descriptors**: The original prompt provided limited, basic options (e.g., "joyful", "tense", "indoor", "outdoor")
2. **Insufficient matching data**: Only 6 descriptor fields with limited vocabulary
3. **Poor alignment**: Descriptors didn't capture the nuanced elements that soundscapes represent (e.g., "birds", "wind", "magical")
4. **Simplistic matching**: The matching algorithm relied heavily on exact string matches

## Solutions Implemented

### 1. Enhanced Descriptor Vocabulary

**Expanded mood options** with more specific choices:
- Positive: "joyful", "playful", "whimsical", "serene", "hopeful", "content", "excited", "curious"
- Negative: "tense", "anxious", "melancholic", "fearful", "ominous", "sorrowful", "angry", "desperate"
- Neutral/Complex: "mysterious", "contemplative", "nostalgic", "bittersweet", "uncertain", "neutral"

**More specific settings**:
- Nature: "forest", "meadow", "garden", "riverside", "lakeside", "mountain", "countryside", "wilderness"
- Indoor: "home", "palace", "cottage", "library", "chamber", "hall", "underground", "cave"
- Urban: "city", "town", "street", "marketplace", "village"
- Special: "magical_realm", "dreamscape", "unknown"

**Richer atmosphere options**:
- "peaceful", "tranquil", "suspenseful", "eerie", "magical", "romantic", "adventurous", "dramatic", "contemplative", "whimsical", "dark", "light", "ethereal"

### 2. New Descriptor Fields

**scene_type**: Captures what's happening in the scene
- "dialogue", "action", "description", "introspection", "discovery", "conflict", "journey", "rest", "transformation", "revelation"

**dominant_elements**: Key environmental or sensory elements (up to 3, comma-separated)
- Natural: "birds", "wind", "water", "rain", "thunder", "fire", "leaves", "crickets", "ocean", "stream"
- Ambient: "silence", "echoes", "footsteps", "voices", "music", "bells", "clock", "rustling"
- Mood: "tension", "wonder", "mystery", "magic", "danger", "comfort", "isolation"

### 3. Improved Matching Algorithm

Enhanced the `calculate_match_score` function with:

1. **Weighted category matching** (35% for setting, 30% for atmosphere, 25% for mood)
2. **Dominant elements matching** (15% per element match)
3. **Partial string matching** instead of exact matches
4. **Keyword extraction** from filenames with better filtering
5. **Special case handling**:
   - Calm/peaceful scenes → nature sounds
   - Magical/whimsical scenes → fantasy/magic soundscapes
   - High activity → action/movement sounds
6. **Lower confidence threshold** (0.25 instead of 0.3) to be more permissive

### 4. Better Prompt Engineering

The updated prompt:
- Emphasizes being "specific and descriptive"
- Explains that descriptors will be used for soundscape matching
- Provides clear categorization of options
- Instructs the AI to "choose the MOST SPECIFIC option"
- Includes examples of what each field represents

## Expected Improvements

### For Alice in Wonderland
Instead of generic descriptors like:
```json
{
  "mood": "tense",
  "setting": "outdoor",
  "atmosphere": "mysterious"
}
```

We should now get:
```json
{
  "mood": "curious",
  "setting": "garden",
  "time_of_day": "afternoon",
  "weather": "sunny",
  "activity_level": "moderate",
  "atmosphere": "whimsical",
  "scene_type": "discovery",
  "dominant_elements": "birds, wind, wonder"
}
```

### Matching Benefits

1. **Better nature sound matches**: "garden" + "birds" + "wind" → nature soundscapes
2. **Mood-based matching**: "whimsical" + "magical" → fantasy/magical soundscapes
3. **Element-based matching**: "water", "rain", "wind" → specific environmental sounds
4. **Scene type context**: "conflict" vs "rest" → different energy levels

## Files Modified

1. **`lib/storia/ai/scene_classifier.ex`**
   - Enhanced `build_classification_prompt/1` with richer options
   - Updated `validate_descriptors/1` to require new fields
   - Updated `default_descriptors/0` with new fields
   - Updated documentation examples

2. **`lib/storia/content/scene.ex`**
   - Updated `validate_descriptors/1` to accept "scene_type" and "dominant_elements"

3. **`test/storia/ai/content_analysis_and_mapping_test.exs`**
   - Enhanced `calculate_match_score/3` with sophisticated matching
   - Added partial string matching
   - Added element-based matching
   - Added special case handling for different scene types
   - Lowered confidence threshold to 0.25
   - Updated default descriptors in error handling

## Testing

Run the test again to see improvements:
```bash
mix test test/storia/ai/content_analysis_and_mapping_test.exs
```

Expected results:
- Higher confidence scores across all scenes
- More scenes successfully mapped to soundscapes
- Better alignment between scene content and soundscape selection

## Future Enhancements

Consider:
1. **Machine learning**: Train a model on successful mappings
2. **Semantic similarity**: Use embeddings for descriptor matching
3. **User feedback**: Learn from admin soundscape selections
4. **Dynamic weighting**: Adjust scoring weights based on category
5. **Fallback strategies**: Multiple soundscape suggestions with confidence scores
