/**
 * Soundscape Generation Module
 * 
 * Generates AI-powered ambient soundscapes using Replicate API and stores them
 * in Cloudflare R2 for permanent access. Provides both simple and polling-based
 * generation methods for different use cases.
 * 
 * Requirements: 4.1, 4.2, 4.3, 4.4
 */

import { replicate, PRIMARY_AUDIO_MODEL, getModelConfig } from "./replicate";
import { uploadToR2 } from "./storage";
import { ExternalAPIError } from "./errors";
import type { SceneAnalysis } from "./analyzeContent";

/**
 * Result of soundscape generation
 */
export interface SoundscapeResult {
  audioUrl: string;           // Permanent R2 URL
  duration: number;            // Duration in seconds
  predictionId: string;        // Replicate prediction ID
  prompt: string;              // Audio generation prompt used
  replicateUrl?: string;       // Original Replicate URL (temporary)
}

/**
 * Generate a soundscape using Replicate's simple run() method
 * 
 * This is the simpler approach that waits for the prediction to complete.
 * Best for synchronous workflows where you can wait for generation.
 * Generates 15-second looping audio optimized for ambient soundscapes.
 * 
 * Process:
 * 1. Generate audio using Replicate API (ElevenLabs Music model)
 * 2. Download the generated audio file
 * 3. Upload to Cloudflare R2 for permanence
 * 4. Return soundscape metadata
 * 
 * @param sceneAnalysis - Scene analysis containing audio prompt
 * @param sceneId - Unique scene identifier for storage
 * @returns Promise<SoundscapeResult> - Generated soundscape metadata
 * @throws ExternalAPIError if Replicate API fails
 * @throws Error if audio download or upload fails
 * 
 * @example
 * ```typescript
 * const analysis = await analyzePageContent(pageText, 1);
 * const soundscape = await generateSoundscape(analysis, "scene-123");
 * console.log(soundscape.audioUrl); // R2 URL for playback
 * ```
 */
export async function generateSoundscape(
  sceneAnalysis: SceneAnalysis,
  sceneId: string
): Promise<SoundscapeResult> {
  try {
    console.log(`🎵 Generating soundscape for scene ${sceneId}...`);
    console.log(`📝 Prompt: ${sceneAnalysis.audioPrompt}`);

    // Get model configuration
    const config = getModelConfig(PRIMARY_AUDIO_MODEL);

    // Generate audio using Replicate
    const startTime = Date.now();
    const output = await replicate.run(
      config.model,
      {
        input: {
          prompt: sceneAnalysis.audioPrompt,
          ...config.defaultInput,
        },
      }
    );

    const generationTime = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✅ Audio generated in ${generationTime}s`);

    // Extract audio URL from output
    let audioUrl: string;
    if (typeof output === "string") {
      audioUrl = output;
    } else if (Array.isArray(output) && output.length > 0) {
      audioUrl = output[0];
    } else {
      throw new Error("Unexpected output format from Replicate");
    }

    if (!audioUrl || !audioUrl.startsWith("http")) {
      throw new Error("Invalid audio URL returned from Replicate");
    }

    console.log(`📥 Temporary audio URL: ${audioUrl}`);

    // Upload to R2 for permanence
    const permanentUrl = await uploadToR2(audioUrl, sceneId);

    const result: SoundscapeResult = {
      audioUrl: permanentUrl,
      duration: 15, // Default duration from config
      predictionId: "unknown", // run() doesn't expose prediction ID
      prompt: sceneAnalysis.audioPrompt,
      replicateUrl: audioUrl,
    };

    console.log(`✅ Soundscape ready: ${permanentUrl}`);
    return result;

  } catch (error) {
    console.error(`❌ Error generating soundscape for scene ${sceneId}:`, error);
    
    if (error instanceof Error) {
      throw new ExternalAPIError("Replicate", error);
    }
    
    throw new Error("Soundscape generation failed with unknown error");
  }
}

/**
 * Generate a soundscape with polling for better control
 * 
 * This approach uses Replicate's predictions API for more control over
 * the generation process. Allows for status monitoring and cancellation.
 * Generates 15-second looping audio optimized for ambient soundscapes.
 * 
 * Process:
 * 1. Create a prediction on Replicate
 * 2. Poll for completion with exponential backoff
 * 3. Download the generated audio file
 * 4. Upload to Cloudflare R2 for permanence
 * 5. Return soundscape metadata with prediction ID
 * 
 * @param sceneAnalysis - Scene analysis containing audio prompt
 * @param sceneId - Unique scene identifier for storage
 * @param maxWaitTime - Maximum time to wait in seconds (default: 300 = 5 minutes)
 * @returns Promise<SoundscapeResult> - Generated soundscape metadata
 * @throws ExternalAPIError if Replicate API fails
 * @throws Error if generation times out or fails
 * 
 * @example
 * ```typescript
 * const analysis = await analyzePageContent(pageText, 1);
 * const soundscape = await generateSoundscapeWithPolling(analysis, "scene-123");
 * console.log(soundscape.predictionId); // Track prediction status
 * ```
 */
export async function generateSoundscapeWithPolling(
  sceneAnalysis: SceneAnalysis,
  sceneId: string,
  maxWaitTime: number = 300
): Promise<SoundscapeResult> {
  try {
    console.log(`🎵 Creating soundscape prediction for scene ${sceneId}...`);
    console.log(`📝 Prompt: ${sceneAnalysis.audioPrompt}`);

    // Get model configuration
    const config = getModelConfig(PRIMARY_AUDIO_MODEL);

    // Create prediction
    const startTime = Date.now();
    let prediction = await replicate.predictions.create({
      model: config.model,
      input: {
        prompt: sceneAnalysis.audioPrompt,
        ...config.defaultInput,
      },
    });

    console.log(`🔄 Prediction created: ${prediction.id}`);
    console.log(`📊 Status: ${prediction.status}`);

    // Poll for completion
    const pollInterval = 2000; // Start with 2 seconds
    const maxPollInterval = 10000; // Max 10 seconds between polls
    let currentInterval = pollInterval;
    let elapsedTime = 0;

    while (
      prediction.status !== "succeeded" &&
      prediction.status !== "failed" &&
      prediction.status !== "canceled"
    ) {
      // Check timeout
      if (elapsedTime >= maxWaitTime * 1000) {
        throw new Error(`Soundscape generation timed out after ${maxWaitTime}s`);
      }

      // Wait before next poll
      await new Promise((resolve) => setTimeout(resolve, currentInterval));
      elapsedTime += currentInterval;

      // Exponential backoff (up to max)
      currentInterval = Math.min(currentInterval * 1.5, maxPollInterval);

      // Get updated prediction status
      prediction = await replicate.predictions.get(prediction.id);
      console.log(`🔄 Status: ${prediction.status} (${(elapsedTime / 1000).toFixed(1)}s elapsed)`);
    }

    // Check final status
    if (prediction.status === "failed") {
      const errorMsg = prediction.error || "Unknown error";
      throw new Error(`Prediction failed: ${errorMsg}`);
    }

    if (prediction.status === "canceled") {
      throw new Error("Prediction was canceled");
    }

    const generationTime = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✅ Audio generated in ${generationTime}s`);

    // Extract audio URL from output
    const output = prediction.output;
    let audioUrl: string;
    
    if (typeof output === "string") {
      audioUrl = output;
    } else if (Array.isArray(output) && output.length > 0) {
      audioUrl = output[0];
    } else {
      throw new Error("Unexpected output format from prediction");
    }

    if (!audioUrl || !audioUrl.startsWith("http")) {
      throw new Error("Invalid audio URL returned from prediction");
    }

    console.log(`📥 Temporary audio URL: ${audioUrl}`);

    // Upload to R2 for permanence
    const permanentUrl = await uploadToR2(audioUrl, sceneId);

    const result: SoundscapeResult = {
      audioUrl: permanentUrl,
      duration: 15, // Default duration from config
      predictionId: prediction.id,
      prompt: sceneAnalysis.audioPrompt,
      replicateUrl: audioUrl,
    };

    console.log(`✅ Soundscape ready: ${permanentUrl}`);
    return result;

  } catch (error) {
    console.error(`❌ Error generating soundscape with polling for scene ${sceneId}:`, error);
    
    if (error instanceof Error) {
      throw new ExternalAPIError("Replicate", error);
    }
    
    throw new Error("Soundscape generation with polling failed with unknown error");
  }
}

/**
 * Generate soundscape with automatic retry logic
 * 
 * Wraps generateSoundscape() with exponential backoff retry strategy.
 * Handles transient API failures gracefully.
 * 
 * @param sceneAnalysis - Scene analysis containing audio prompt
 * @param sceneId - Unique scene identifier
 * @param maxRetries - Maximum retry attempts (default: 3)
 * @returns Promise<SoundscapeResult> - Generated soundscape metadata
 * @throws Error if all retry attempts fail
 * 
 * @example
 * ```typescript
 * const soundscape = await generateSoundscapeWithRetry(analysis, "scene-123", 3);
 * ```
 */
export async function generateSoundscapeWithRetry(
  sceneAnalysis: SceneAnalysis,
  sceneId: string,
  maxRetries: number = 3
): Promise<SoundscapeResult> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await generateSoundscape(sceneAnalysis, sceneId);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Unknown error");
      
      console.error(
        `Soundscape generation attempt ${attempt + 1}/${maxRetries} failed for scene ${sceneId}:`,
        error
      );
      
      // Don't wait after the last attempt
      if (attempt < maxRetries - 1) {
        // Exponential backoff: 2s, 4s, 8s
        const delayMs = Math.pow(2, attempt + 1) * 1000;
        console.log(`Retrying in ${delayMs / 1000}s...`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  throw new Error(
    `Soundscape generation failed for scene ${sceneId} after ${maxRetries} attempts: ${lastError?.message || "Unknown error"}`
  );
}

/**
 * Batch generate soundscapes for multiple scenes
 * 
 * Processes scenes sequentially to avoid overwhelming the API.
 * Each generation includes retry logic for reliability.
 * 
 * @param scenes - Array of scene analyses with IDs
 * @param maxRetries - Maximum retry attempts per scene (default: 3)
 * @returns Promise<SoundscapeResult[]> - Array of generated soundscapes
 * @throws Error if any scene fails after retries
 * 
 * @example
 * ```typescript
 * const scenes = [
 *   { analysis: analysis1, sceneId: "scene-1" },
 *   { analysis: analysis2, sceneId: "scene-2" }
 * ];
 * const soundscapes = await batchGenerateSoundscapes(scenes);
 * ```
 */
export async function batchGenerateSoundscapes(
  scenes: Array<{ analysis: SceneAnalysis; sceneId: string }>,
  maxRetries: number = 3
): Promise<SoundscapeResult[]> {
  const results: SoundscapeResult[] = [];

  for (const scene of scenes) {
    try {
      const soundscape = await generateSoundscapeWithRetry(
        scene.analysis,
        scene.sceneId,
        maxRetries
      );
      results.push(soundscape);
    } catch (error) {
      console.error(`Failed to generate soundscape for scene ${scene.sceneId}:`, error);
      throw error; // Re-throw to stop batch processing on failure
    }
  }

  return results;
}

/**
 * Estimate soundscape generation cost
 * 
 * Provides cost estimation for planning and budgeting.
 * Based on ElevenLabs Music model pricing.
 * 
 * @param sceneCount - Number of scenes to generate
 * @returns Estimated cost in USD
 * 
 * @example
 * ```typescript
 * const cost = estimateGenerationCost(50);
 * console.log(`Estimated cost: $${cost.toFixed(2)}`);
 * ```
 */
export function estimateGenerationCost(sceneCount: number): number {
  // ElevenLabs Music pricing: ~$0.05 per generation (15s audio)
  const costPerGeneration = 0.05;
  return sceneCount * costPerGeneration;
}

/**
 * Validate scene analysis for soundscape generation
 * 
 * Ensures the scene analysis has all required fields for audio generation.
 * 
 * @param analysis - Scene analysis to validate
 * @returns true if valid, throws error otherwise
 * @throws Error if validation fails
 * 
 * @example
 * ```typescript
 * try {
 *   validateSceneAnalysis(analysis);
 *   const soundscape = await generateSoundscape(analysis, sceneId);
 * } catch (error) {
 *   console.error("Invalid scene analysis:", error);
 * }
 * ```
 */
export function validateSceneAnalysis(analysis: SceneAnalysis): boolean {
  if (!analysis.audioPrompt || analysis.audioPrompt.trim().length === 0) {
    throw new Error("Scene analysis missing audio prompt");
  }

  if (!analysis.setting || analysis.setting.trim().length === 0) {
    throw new Error("Scene analysis missing setting");
  }

  if (!analysis.mood || analysis.mood.trim().length === 0) {
    throw new Error("Scene analysis missing mood");
  }

  if (!["low", "medium", "high"].includes(analysis.intensity)) {
    throw new Error(`Invalid intensity level: ${analysis.intensity}`);
  }

  return true;
}
