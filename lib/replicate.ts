import Replicate from "replicate";

// Lazy initialization of Replicate client
let _replicate: Replicate | null = null;

function getReplicate(): Replicate {
  if (!_replicate) {
    if (!process.env.REPLICATE_API_TOKEN) {
      throw new Error("REPLICATE_API_TOKEN environment variable is not set");
    }
    _replicate = new Replicate({
      auth: process.env.REPLICATE_API_TOKEN,
    });
  }
  return _replicate;
}

// Export replicate client (lazy-loaded on first access)
export const replicate = new Proxy({} as Replicate, {
  get(target, prop) {
    const client = getReplicate();
    const value = (client as any)[prop];
    return typeof value === 'function' ? value.bind(client) : value;
  }
});

// Audio model constants
export const AUDIO_MODELS = {
  ELEVENLABS_MUSIC: "elevenlabs/music",
  MUSICGEN: "meta/musicgen",
  STABLE_AUDIO: "stability-ai/stable-audio",
  RIFFUSION: "riffusion/riffusion",
} as const;

// Primary model for soundscape generation
export const PRIMARY_AUDIO_MODEL = AUDIO_MODELS.ELEVENLABS_MUSIC;

// Model configurations
export const MODEL_CONFIGS = {
  [AUDIO_MODELS.ELEVENLABS_MUSIC]: {
    model: AUDIO_MODELS.ELEVENLABS_MUSIC,
    version: "latest",
    defaultInput: {
      music_length_ms: 15000, // 15 seconds
      output_format: "wav_cd_quality",
      force_instrumental: false,
    },
  },
  [AUDIO_MODELS.MUSICGEN]: {
    model: AUDIO_MODELS.MUSICGEN,
    version: "latest",
    defaultInput: {
      duration: 15, // 15 seconds
      model_version: "stereo-large",
      output_format: "wav",
      normalization_strategy: "peak",
    },
  },
  [AUDIO_MODELS.STABLE_AUDIO]: {
    model: AUDIO_MODELS.STABLE_AUDIO,
    version: "latest",
    defaultInput: {
      seconds_total: 15,
      steps: 100,
      cfg_scale: 7,
    },
  },
  [AUDIO_MODELS.RIFFUSION]: {
    model: AUDIO_MODELS.RIFFUSION,
    version: "latest",
    defaultInput: {
      alpha: 0.5,
      num_inference_steps: 50,
      seed_image_id: "vibes",
    },
  },
} as const;

// Type definitions
export type AudioModel = (typeof AUDIO_MODELS)[keyof typeof AUDIO_MODELS];

export interface ModelConfig {
  model: AudioModel;
  version: string;
  defaultInput: Record<string, any>;
}

// Helper function to get model configuration
export function getModelConfig(model: AudioModel): ModelConfig {
  const config = MODEL_CONFIGS[model];
  if (!config) {
    throw new Error(`Unknown audio model: ${model}`);
  }
  return config;
}

// Helper function to validate model
export function isValidAudioModel(model: string): model is AudioModel {
  return Object.values(AUDIO_MODELS).includes(model as AudioModel);
}
