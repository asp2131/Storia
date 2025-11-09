/**
 * Soundscape Caching System
 * 
 * Implements intelligent caching of generated soundscapes to avoid redundant
 * generation for similar scenes. Caches based on setting, mood, and intensity
 * to maximize reuse across books while maintaining quality.
 * 
 * Requirements: 4.5
 */

import { PrismaClient } from "@prisma/client";
import type { SceneAnalysis } from "./analyzeContent";

const prisma = new PrismaClient();

/**
 * Cached soundscape result
 */
export interface CachedSoundscape {
  id: string;
  audioUrl: string;
  duration: number;
  generationPrompt: string;
  sceneId: string;
  setting: string;
  mood: string;
  intensity: string;
}

/**
 * Generate a cache key from scene analysis
 * 
 * Creates a normalized cache key based on the core narrative elements
 * that define a soundscape: setting, mood, and intensity.
 * 
 * The key is normalized to improve cache hit rates:
 * - Lowercase for case-insensitive matching
 * - Trimmed whitespace
 * - Consistent separator (|)
 * 
 * @param sceneAnalysis - Scene analysis to generate key from
 * @returns Normalized cache key string
 * 
 * @example
 * ```typescript
 * const key = generateCacheKey({
 *   setting: "Dark Forest",
 *   mood: "Tense",
 *   intensity: "high"
 * });
 * // Returns: "dark forest|tense|high"
 * ```
 */
export function generateCacheKey(sceneAnalysis: SceneAnalysis): string {
  const setting = sceneAnalysis.setting.toLowerCase().trim();
  const mood = sceneAnalysis.mood.toLowerCase().trim();
  const intensity = sceneAnalysis.intensity.toLowerCase().trim();
  
  return `${setting}|${mood}|${intensity}`;
}

/**
 * Find a cached soundscape for similar scenes
 * 
 * Searches the database for existing soundscapes that match the scene's
 * setting, mood, and intensity. This allows reuse of soundscapes across
 * different books and scenes with similar characteristics.
 * 
 * The function performs a case-insensitive search on the scene's descriptors
 * stored as JSON in the database. It looks for exact matches on all three
 * key attributes to ensure quality.
 * 
 * Benefits:
 * - Reduces API costs by reusing existing soundscapes
 * - Faster processing (no generation wait time)
 * - Consistent audio quality across similar scenes
 * - Estimated 30-50% cache hit rate in production
 * 
 * @param sceneAnalysis - Scene analysis to find cached soundscape for
 * @param excludeBookId - Optional book ID to exclude from search (avoid self-caching)
 * @returns Promise<CachedSoundscape | null> - Cached soundscape if found, null otherwise
 * 
 * @example
 * ```typescript
 * const analysis = await analyzePageContent(pageText, 1);
 * const cached = await findCachedSoundscape(analysis);
 * 
 * if (cached) {
 *   console.log("Using cached soundscape:", cached.audioUrl);
 * } else {
 *   console.log("Generating new soundscape...");
 *   const soundscape = await generateSoundscape(analysis, sceneId);
 * }
 * ```
 */
export async function findCachedSoundscape(
  sceneAnalysis: SceneAnalysis,
  excludeBookId?: string
): Promise<CachedSoundscape | null> {
  try {
    // Normalize search values for case-insensitive matching
    const setting = sceneAnalysis.setting.toLowerCase().trim();
    const mood = sceneAnalysis.mood.toLowerCase().trim();
    const intensity = sceneAnalysis.intensity.toLowerCase().trim();

    console.log(`🔍 Searching cache for: ${setting} | ${mood} | ${intensity}`);

    // Query database for matching soundscapes
    // We search for scenes with matching setting, mood, and intensity
    // The descriptors field is JSONB, so we can query its properties
    const matchingScene = await prisma.scene.findFirst({
      where: {
        AND: [
          // Exclude scenes from the same book if specified
          excludeBookId ? { bookId: { not: excludeBookId } } : {},
          // Match setting (case-insensitive)
          {
            setting: {
              equals: setting,
              mode: "insensitive",
            },
          },
          // Match mood (case-insensitive)
          {
            mood: {
              equals: mood,
              mode: "insensitive",
            },
          },
          // Match intensity from descriptors JSON
          {
            descriptors: {
              path: ["intensity"],
              equals: intensity,
            },
          },
        ],
      },
      include: {
        soundscapes: {
          take: 1, // Only need one soundscape per scene
          orderBy: {
            createdAt: "desc", // Get the most recent one
          },
        },
      },
    });

    // Check if we found a matching scene with a soundscape
    if (!matchingScene || matchingScene.soundscapes.length === 0) {
      console.log("❌ No cached soundscape found");
      return null;
    }

    const soundscape = matchingScene.soundscapes[0];
    
    console.log(`✅ Found cached soundscape: ${soundscape.id}`);
    console.log(`📁 Audio URL: ${soundscape.audioUrl}`);

    // Return cached soundscape data
    return {
      id: soundscape.id,
      audioUrl: soundscape.audioUrl,
      duration: soundscape.duration,
      generationPrompt: soundscape.generationPrompt || "",
      sceneId: matchingScene.id,
      setting: matchingScene.setting || "",
      mood: matchingScene.mood || "",
      intensity: intensity,
    };
  } catch (error) {
    console.error("Error searching soundscape cache:", error);
    // Return null on error to allow fallback to generation
    return null;
  }
}

/**
 * Find multiple cached soundscapes for batch processing
 * 
 * Efficiently searches for cached soundscapes for multiple scene analyses.
 * Useful for background job processing where you're analyzing an entire book.
 * 
 * @param sceneAnalyses - Array of scene analyses to find cached soundscapes for
 * @param excludeBookId - Optional book ID to exclude from search
 * @returns Promise<Array<CachedSoundscape | null>> - Array of cached soundscapes (null if not found)
 * 
 * @example
 * ```typescript
 * const analyses = await batchAnalyzePageSpreads(pages);
 * const cached = await findCachedSoundscapes(analyses, bookId);
 * 
 * // Process results
 * for (let i = 0; i < analyses.length; i++) {
 *   if (cached[i]) {
 *     console.log(`Using cached soundscape for scene ${i}`);
 *   } else {
 *     console.log(`Generating new soundscape for scene ${i}`);
 *   }
 * }
 * ```
 */
export async function findCachedSoundscapes(
  sceneAnalyses: SceneAnalysis[],
  excludeBookId?: string
): Promise<Array<CachedSoundscape | null>> {
  const results: Array<CachedSoundscape | null> = [];

  for (const analysis of sceneAnalyses) {
    const cached = await findCachedSoundscape(analysis, excludeBookId);
    results.push(cached);
  }

  return results;
}

/**
 * Get cache statistics
 * 
 * Provides insights into cache performance and usage.
 * Useful for monitoring and optimization.
 * 
 * @returns Promise<CacheStats> - Cache statistics
 * 
 * @example
 * ```typescript
 * const stats = await getCacheStats();
 * console.log(`Total soundscapes: ${stats.totalSoundscapes}`);
 * console.log(`Unique cache keys: ${stats.uniqueCacheKeys}`);
 * ```
 */
export interface CacheStats {
  totalSoundscapes: number;
  uniqueCacheKeys: number;
  totalScenes: number;
  averageSoundscapesPerKey: number;
}

export async function getCacheStats(): Promise<CacheStats> {
  try {
    // Count total soundscapes
    const totalSoundscapes = await prisma.soundscape.count();

    // Count total scenes
    const totalScenes = await prisma.scene.count();

    // Get unique combinations of setting + mood + intensity
    const uniqueScenes = await prisma.scene.groupBy({
      by: ["setting", "mood"],
      _count: true,
    });

    const uniqueCacheKeys = uniqueScenes.length;
    const averageSoundscapesPerKey = uniqueCacheKeys > 0 
      ? totalSoundscapes / uniqueCacheKeys 
      : 0;

    return {
      totalSoundscapes,
      uniqueCacheKeys,
      totalScenes,
      averageSoundscapesPerKey: Math.round(averageSoundscapesPerKey * 100) / 100,
    };
  } catch (error) {
    console.error("Error getting cache stats:", error);
    return {
      totalSoundscapes: 0,
      uniqueCacheKeys: 0,
      totalScenes: 0,
      averageSoundscapesPerKey: 0,
    };
  }
}

/**
 * Clear cache for a specific book
 * 
 * Removes all soundscapes associated with a book's scenes.
 * Useful for cleanup when a book is deleted or reprocessed.
 * 
 * @param bookId - Book ID to clear cache for
 * @returns Promise<number> - Number of soundscapes deleted
 * 
 * @example
 * ```typescript
 * const deleted = await clearBookCache(bookId);
 * console.log(`Deleted ${deleted} soundscapes`);
 * ```
 */
export async function clearBookCache(bookId: string): Promise<number> {
  try {
    // Get all scene IDs for the book
    const scenes = await prisma.scene.findMany({
      where: { bookId },
      select: { id: true },
    });

    const sceneIds = scenes.map((s) => s.id);

    // Delete all soundscapes for these scenes
    const result = await prisma.soundscape.deleteMany({
      where: {
        sceneId: {
          in: sceneIds,
        },
      },
    });

    console.log(`🗑️ Cleared ${result.count} soundscapes for book ${bookId}`);
    return result.count;
  } catch (error) {
    console.error(`Error clearing cache for book ${bookId}:`, error);
    return 0;
  }
}

/**
 * Validate cache integrity
 * 
 * Checks for soundscapes with missing or invalid audio URLs.
 * Useful for maintenance and debugging.
 * 
 * @returns Promise<string[]> - Array of soundscape IDs with issues
 * 
 * @example
 * ```typescript
 * const invalid = await validateCacheIntegrity();
 * if (invalid.length > 0) {
 *   console.log(`Found ${invalid.length} invalid soundscapes`);
 * }
 * ```
 */
export async function validateCacheIntegrity(): Promise<string[]> {
  try {
    const invalidSoundscapes = await prisma.soundscape.findMany({
      where: {
        OR: [
          { audioUrl: "" },
          { audioUrl: { not: { startsWith: "http" } } },
        ],
      },
      select: { id: true },
    });

    return invalidSoundscapes.map((s) => s.id);
  } catch (error) {
    console.error("Error validating cache integrity:", error);
    return [];
  }
}
