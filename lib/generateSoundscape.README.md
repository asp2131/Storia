# Soundscape Generation Module

This module generates AI-powered ambient soundscapes using the Replicate API and stores them in Cloudflare R2 for permanent access.

## Overview

The soundscape generation module provides two main approaches:
1. **Simple Generation** (`generateSoundscape`) - Uses `replicate.run()` for straightforward synchronous generation
2. **Polling Generation** (`generateSoundscapeWithPolling`) - Uses predictions API for better control and monitoring

Both methods:
- Generate 15-second looping audio using ElevenLabs Music model
- Download the generated audio from Replicate
- Upload to Cloudflare R2 for permanence
- Return comprehensive metadata

## Requirements

Ensure these environment variables are set:

```env
REPLICATE_API_TOKEN=r8_your_token_here
CLOUDFLARE_R2_ACCESS_KEY=your_access_key
CLOUDFLARE_R2_SECRET_KEY=your_secret_key
CLOUDFLARE_R2_BUCKET=your_bucket_name
CLOUDFLARE_R2_PUBLIC_DOMAIN=your_public_domain
CLOUDFLARE_ACCOUNT_ID=your_account_id
```

## Usage

### Basic Generation

```typescript
import { generateSoundscape } from "@/lib/generateSoundscape";
import { analyzePageContent } from "@/lib/analyzeContent";

// Analyze page content
const analysis = await analyzePageContent(pageText, 1);

// Generate soundscape
const soundscape = await generateSoundscape(analysis, "scene-123");

console.log(soundscape.audioUrl);      // R2 URL for playback
console.log(soundscape.duration);      // 15 seconds
console.log(soundscape.prompt);        // Audio generation prompt
```

### Generation with Polling

For better control and status monitoring:

```typescript
import { generateSoundscapeWithPolling } from "@/lib/generateSoundscape";

const soundscape = await generateSoundscapeWithPolling(
  analysis,
  "scene-123",
  300 // Max wait time in seconds (5 minutes)
);

console.log(soundscape.predictionId);  // Track prediction status
console.log(soundscape.audioUrl);      // Permanent R2 URL
```

### Generation with Retry Logic

Automatically retry on transient failures:

```typescript
import { generateSoundscapeWithRetry } from "@/lib/generateSoundscape";

const soundscape = await generateSoundscapeWithRetry(
  analysis,
  "scene-123",
  3 // Max retry attempts
);
```

### Batch Generation

Process multiple scenes sequentially:

```typescript
import { batchGenerateSoundscapes } from "@/lib/generateSoundscape";

const scenes = [
  { analysis: analysis1, sceneId: "scene-1" },
  { analysis: analysis2, sceneId: "scene-2" },
  { analysis: analysis3, sceneId: "scene-3" }
];

const soundscapes = await batchGenerateSoundscapes(scenes, 3);
```

## API Reference

### `generateSoundscape(sceneAnalysis, sceneId)`

Simple synchronous generation using `replicate.run()`.

**Parameters:**
- `sceneAnalysis: SceneAnalysis` - Scene analysis with audio prompt
- `sceneId: string` - Unique scene identifier

**Returns:** `Promise<SoundscapeResult>`

**Example:**
```typescript
const result = await generateSoundscape(analysis, "scene-123");
```

---

### `generateSoundscapeWithPolling(sceneAnalysis, sceneId, maxWaitTime?)`

Advanced generation with polling for better control.

**Parameters:**
- `sceneAnalysis: SceneAnalysis` - Scene analysis with audio prompt
- `sceneId: string` - Unique scene identifier
- `maxWaitTime?: number` - Max wait time in seconds (default: 300)

**Returns:** `Promise<SoundscapeResult>`

**Example:**
```typescript
const result = await generateSoundscapeWithPolling(analysis, "scene-123", 300);
```

---

### `generateSoundscapeWithRetry(sceneAnalysis, sceneId, maxRetries?)`

Generation with automatic retry logic.

**Parameters:**
- `sceneAnalysis: SceneAnalysis` - Scene analysis with audio prompt
- `sceneId: string` - Unique scene identifier
- `maxRetries?: number` - Max retry attempts (default: 3)

**Returns:** `Promise<SoundscapeResult>`

**Example:**
```typescript
const result = await generateSoundscapeWithRetry(analysis, "scene-123", 3);
```

---

### `batchGenerateSoundscapes(scenes, maxRetries?)`

Batch generate soundscapes for multiple scenes.

**Parameters:**
- `scenes: Array<{ analysis: SceneAnalysis; sceneId: string }>` - Array of scenes
- `maxRetries?: number` - Max retry attempts per scene (default: 3)

**Returns:** `Promise<SoundscapeResult[]>`

**Example:**
```typescript
const results = await batchGenerateSoundscapes(scenes, 3);
```

---

### `validateSceneAnalysis(analysis)`

Validate scene analysis before generation.

**Parameters:**
- `analysis: SceneAnalysis` - Scene analysis to validate

**Returns:** `boolean` (throws error if invalid)

**Example:**
```typescript
try {
  validateSceneAnalysis(analysis);
  const soundscape = await generateSoundscape(analysis, sceneId);
} catch (error) {
  console.error("Invalid analysis:", error);
}
```

---

### `estimateGenerationCost(sceneCount)`

Estimate cost for generating soundscapes.

**Parameters:**
- `sceneCount: number` - Number of scenes to generate

**Returns:** `number` - Estimated cost in USD

**Example:**
```typescript
const cost = estimateGenerationCost(50);
console.log(`Estimated cost: $${cost.toFixed(2)}`); // $5.00
```

## Types

### `SoundscapeResult`

```typescript
interface SoundscapeResult {
  audioUrl: string;           // Permanent R2 URL
  duration: number;            // Duration in seconds (15)
  predictionId: string;        // Replicate prediction ID
  prompt: string;              // Audio generation prompt used
  replicateUrl?: string;       // Original Replicate URL (temporary)
}
```

### `SceneAnalysis`

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

The module throws the following errors:

- `ExternalAPIError` - Replicate API failures
- `Error` - Audio download/upload failures, validation errors, timeouts

**Example:**
```typescript
try {
  const soundscape = await generateSoundscape(analysis, sceneId);
} catch (error) {
  if (error instanceof ExternalAPIError) {
    console.error("Replicate API error:", error.message);
  } else {
    console.error("Generation error:", error);
  }
}
```

## Performance Considerations

### Generation Time
- Average: 20-40 seconds per soundscape
- Varies based on prompt complexity and API load
- Use polling method for better monitoring

### Cost Optimization
- ElevenLabs Music: ~$0.05 per 15-second generation
- 300-page book with scene every 2 pages: ~150 scenes = $7.50
- Cache similar soundscapes to reduce costs (see `lib/soundscapeCache.ts`)

### Retry Strategy
- Exponential backoff: 2s, 4s, 8s
- Max 3 retries by default
- Handles transient API failures gracefully

## Integration Example

Complete workflow from page analysis to soundscape:

```typescript
import { analyzePageSpread } from "@/lib/analyzeContent";
import { generateSoundscapeWithRetry } from "@/lib/generateSoundscape";
import { detectSceneChange } from "@/lib/sceneDetection";

// Analyze page spread
const analysis = await analyzePageSpread(
  pages[0].textContent,
  pages[1].textContent,
  1
);

// Check if new scene
const isNewScene = previousAnalysis 
  ? await detectSceneChange(previousAnalysis, analysis)
  : true;

if (isNewScene) {
  // Generate soundscape for new scene
  const soundscape = await generateSoundscapeWithRetry(
    analysis,
    `scene-${sceneId}`,
    3
  );
  
  // Store in database
  await prisma.soundscape.create({
    data: {
      sceneId: sceneId,
      audioUrl: soundscape.audioUrl,
      duration: soundscape.duration,
      generationPrompt: soundscape.prompt,
      replicatePredictionId: soundscape.predictionId,
    }
  });
}
```

## Testing

Test the module with a sample scene:

```typescript
import { generateSoundscape } from "@/lib/generateSoundscape";

const testAnalysis = {
  setting: "A dark forest at night",
  mood: "mysterious and tense",
  weather: "foggy",
  timeOfDay: "night",
  intensity: "medium" as const,
  actions: ["walking", "listening"],
  audioPrompt: "Dark forest ambience with rustling leaves, distant owl hoots, and subtle wind through trees"
};

const result = await generateSoundscape(testAnalysis, "test-scene-1");
console.log("Generated soundscape:", result);
```

## Next Steps

This module will be used by:
- `app/api/generate-soundscapes/route.ts` - Background job processing
- `lib/soundscapeCache.ts` - Caching system (Task 15)
- `components/AudioPlayer.tsx` - Audio playback (Phase 8)

## Related Modules

- `lib/replicate.ts` - Replicate API client
- `lib/analyzeContent.ts` - Content analysis
- `lib/storage.ts` - R2 storage utilities
- `lib/sceneDetection.ts` - Scene change detection
