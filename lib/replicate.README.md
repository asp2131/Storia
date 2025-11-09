# Replicate API Client

This module provides a configured Replicate API client and audio model constants for soundscape generation.

## Setup

Ensure the `REPLICATE_API_TOKEN` environment variable is set in your `.env` file:

```env
REPLICATE_API_TOKEN=r8_your_token_here
```

## Usage

### Basic Client Usage

```typescript
import { replicate } from "@/lib/replicate";

// Run a prediction
const output = await replicate.run(
  "elevenlabs/music",
  {
    input: {
      prompt: "Peaceful forest ambience with birds chirping",
      music_length_ms: 30000,
    }
  }
);
```

### Using Model Constants

```typescript
import { 
  replicate, 
  AUDIO_MODELS, 
  PRIMARY_AUDIO_MODEL,
  getModelConfig 
} from "@/lib/replicate";

// Use the primary model (ElevenLabs Music)
const config = getModelConfig(PRIMARY_AUDIO_MODEL);

// Or use a specific model
const musicGenConfig = getModelConfig(AUDIO_MODELS.MUSICGEN);
```

### Model Configurations

The module provides pre-configured settings for multiple audio models:

#### ElevenLabs Music (Primary)
- **Model**: `elevenlabs/music`
- **Duration**: 15 seconds
- **Format**: WAV CD quality
- **Best for**: High-quality ambient soundscapes with natural sounds

#### MusicGen
- **Model**: `meta/musicgen`
- **Duration**: 15 seconds
- **Format**: WAV
- **Best for**: Musical compositions and melodic soundscapes

#### Stable Audio
- **Model**: `stability-ai/stable-audio`
- **Duration**: 15 seconds
- **Best for**: Experimental and abstract soundscapes

#### Riffusion
- **Model**: `riffusion/riffusion`
- **Best for**: Music generation from text prompts

## Available Models

```typescript
AUDIO_MODELS = {
  ELEVENLABS_MUSIC: "elevenlabs/music",
  MUSICGEN: "meta/musicgen",
  STABLE_AUDIO: "stability-ai/stable-audio",
  RIFFUSION: "riffusion/riffusion",
}
```

## Helper Functions

### `getModelConfig(model: AudioModel): ModelConfig`

Returns the configuration for a specific audio model.

```typescript
const config = getModelConfig(AUDIO_MODELS.ELEVENLABS_MUSIC);
console.log(config.defaultInput); // { music_length_ms: 15000, ... }
```

### `isValidAudioModel(model: string): boolean`

Validates if a string is a valid audio model identifier.

```typescript
if (isValidAudioModel("elevenlabs/music")) {
  // Model is valid
}
```

## Example: Generate Soundscape

```typescript
import { replicate, PRIMARY_AUDIO_MODEL, getModelConfig } from "@/lib/replicate";

async function generateSoundscape(prompt: string) {
  const config = getModelConfig(PRIMARY_AUDIO_MODEL);
  
  const output = await replicate.run(
    config.model,
    {
      input: {
        prompt,
        ...config.defaultInput,
      }
    }
  );
  
  return output;
}

// Usage
const audioUrl = await generateSoundscape(
  "Dark forest at night with distant thunder and rain"
);
```

## Error Handling

The module will throw an error if the `REPLICATE_API_TOKEN` is not set:

```typescript
// Error: REPLICATE_API_TOKEN environment variable is not set
```

Always ensure the token is configured before importing this module.

## Next Steps

This client will be used by:
- `lib/generateSoundscape.ts` - Main soundscape generation logic
- `app/api/generate-soundscapes/route.ts` - Background job processing
- `lib/soundscapeCache.ts` - Caching system for generated audio
