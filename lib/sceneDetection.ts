/**
 * Scene Detection Module
 * 
 * Detects scene changes between page spreads by comparing narrative elements.
 * A scene change triggers new soundscape generation to maintain immersion.
 * 
 * Requirements: 3.3, 3.5
 */

import { SceneAnalysis } from "./analyzeContent";

/**
 * Detect if a scene change has occurred between two page spreads
 * 
 * Scene change detection logic:
 * - Setting change → New scene
 * - Mood change → New scene
 * - Intensity change ≥ 2 levels → New scene
 * - Otherwise → Continue current scene
 * 
 * This ensures soundscapes stay synchronized with react-pageflip page turns
 * and only change when there's a significant narrative shift.
 * 
 * @param previousAnalysis - Analysis from the previous page spread
 * @param currentAnalysis - Analysis from the current page spread
 * @returns boolean - true if a new scene is detected, false otherwise
 * 
 * @example
 * ```typescript
 * const prevAnalysis = {
 *   setting: "A dark forest",
 *   mood: "tense",
 *   intensity: "medium"
 * };
 * 
 * const currAnalysis = {
 *   setting: "A bustling city street",
 *   mood: "energetic",
 *   intensity: "high"
 * };
 * 
 * const isNewScene = detectSceneChange(prevAnalysis, currAnalysis);
 * // Returns: true (setting changed)
 * ```
 */
export function detectSceneChange(
  previousAnalysis: SceneAnalysis,
  currentAnalysis: SceneAnalysis
): boolean {
  // Check for setting change
  if (hasSettingChanged(previousAnalysis.setting, currentAnalysis.setting)) {
    return true;
  }

  // Check for mood change
  if (hasMoodChanged(previousAnalysis.mood, currentAnalysis.mood)) {
    return true;
  }

  // Check for significant intensity change (≥ 2 levels)
  if (hasSignificantIntensityChange(previousAnalysis.intensity, currentAnalysis.intensity)) {
    return true;
  }

  // No significant changes detected
  return false;
}

/**
 * Check if the setting has changed between two analyses
 * 
 * Uses semantic comparison to detect meaningful setting changes.
 * Minor variations in description are ignored.
 * 
 * @param previousSetting - Setting from previous analysis
 * @param currentSetting - Setting from current analysis
 * @returns boolean - true if setting has changed
 */
function hasSettingChanged(previousSetting: string, currentSetting: string): boolean {
  // Normalize settings for comparison
  const prev = normalizeSetting(previousSetting);
  const curr = normalizeSetting(currentSetting);

  // Direct comparison after normalization
  return prev !== curr;
}

/**
 * Check if the mood has changed between two analyses
 * 
 * Detects changes in emotional tone that would require different soundscapes.
 * 
 * @param previousMood - Mood from previous analysis
 * @param currentMood - Mood from current analysis
 * @returns boolean - true if mood has changed
 */
function hasMoodChanged(previousMood: string, currentMood: string): boolean {
  // Normalize moods for comparison
  const prev = normalizeMood(previousMood);
  const curr = normalizeMood(currentMood);

  // Direct comparison after normalization
  return prev !== curr;
}

/**
 * Check if intensity has changed by 2 or more levels
 * 
 * Intensity levels: low (0), medium (1), high (2)
 * A change of ≥ 2 levels indicates a dramatic shift requiring new soundscape.
 * 
 * @param previousIntensity - Intensity from previous analysis
 * @param currentIntensity - Intensity from current analysis
 * @returns boolean - true if intensity changed by 2+ levels
 */
function hasSignificantIntensityChange(
  previousIntensity: "low" | "medium" | "high",
  currentIntensity: "low" | "medium" | "high"
): boolean {
  const intensityLevels = {
    low: 0,
    medium: 1,
    high: 2,
  };

  const prevLevel = intensityLevels[previousIntensity];
  const currLevel = intensityLevels[currentIntensity];

  // Check if change is 2 or more levels
  return Math.abs(currLevel - prevLevel) >= 2;
}

/**
 * Normalize setting string for comparison
 * 
 * Converts to lowercase and removes common articles/prepositions
 * to focus on the core location/environment.
 * 
 * @param setting - Raw setting string
 * @returns string - Normalized setting
 */
function normalizeSetting(setting: string): string {
  return setting
    .toLowerCase()
    .trim()
    .replace(/^(a|an|the)\s+/i, "") // Remove leading articles
    .replace(/\s+/g, " "); // Normalize whitespace
}

/**
 * Normalize mood string for comparison
 * 
 * Converts to lowercase and trims whitespace for consistent comparison.
 * 
 * @param mood - Raw mood string
 * @returns string - Normalized mood
 */
function normalizeMood(mood: string): string {
  return mood
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " "); // Normalize whitespace
}

/**
 * Calculate similarity score between two scene analyses
 * 
 * Returns a score from 0 (completely different) to 1 (identical).
 * Useful for advanced caching strategies where you want to reuse
 * soundscapes for similar but not identical scenes.
 * 
 * @param analysis1 - First scene analysis
 * @param analysis2 - Second scene analysis
 * @returns number - Similarity score between 0 and 1
 * 
 * @example
 * ```typescript
 * const score = calculateSimilarityScore(scene1, scene2);
 * if (score > 0.8) {
 *   // Scenes are very similar, consider reusing soundscape
 * }
 * ```
 */
export function calculateSimilarityScore(
  analysis1: SceneAnalysis,
  analysis2: SceneAnalysis
): number {
  let score = 0;
  let totalWeight = 0;

  // Setting similarity (weight: 40%)
  const settingWeight = 0.4;
  if (normalizeSetting(analysis1.setting) === normalizeSetting(analysis2.setting)) {
    score += settingWeight;
  }
  totalWeight += settingWeight;

  // Mood similarity (weight: 30%)
  const moodWeight = 0.3;
  if (normalizeMood(analysis1.mood) === normalizeMood(analysis2.mood)) {
    score += moodWeight;
  }
  totalWeight += moodWeight;

  // Intensity similarity (weight: 20%)
  const intensityWeight = 0.2;
  if (analysis1.intensity === analysis2.intensity) {
    score += intensityWeight;
  } else {
    // Partial credit for adjacent intensity levels
    const intensityLevels = { low: 0, medium: 1, high: 2 };
    const diff = Math.abs(
      intensityLevels[analysis1.intensity] - intensityLevels[analysis2.intensity]
    );
    if (diff === 1) {
      score += intensityWeight * 0.5; // 50% credit for adjacent levels
    }
  }
  totalWeight += intensityWeight;

  // Weather similarity (weight: 5%)
  const weatherWeight = 0.05;
  if (analysis1.weather && analysis2.weather) {
    if (analysis1.weather.toLowerCase() === analysis2.weather.toLowerCase()) {
      score += weatherWeight;
    }
  } else if (!analysis1.weather && !analysis2.weather) {
    score += weatherWeight; // Both null/undefined counts as match
  }
  totalWeight += weatherWeight;

  // Time of day similarity (weight: 5%)
  const timeWeight = 0.05;
  if (analysis1.timeOfDay && analysis2.timeOfDay) {
    if (analysis1.timeOfDay.toLowerCase() === analysis2.timeOfDay.toLowerCase()) {
      score += timeWeight;
    }
  } else if (!analysis1.timeOfDay && !analysis2.timeOfDay) {
    score += timeWeight; // Both null/undefined counts as match
  }
  totalWeight += timeWeight;

  // Normalize score to 0-1 range
  return score / totalWeight;
}

/**
 * Determine if two scenes are similar enough to share a soundscape
 * 
 * Uses similarity threshold to decide if soundscape caching can be applied.
 * Default threshold is 0.85 (85% similar).
 * 
 * @param analysis1 - First scene analysis
 * @param analysis2 - Second scene analysis
 * @param threshold - Similarity threshold (default: 0.85)
 * @returns boolean - true if scenes are similar enough to share soundscape
 * 
 * @example
 * ```typescript
 * if (areScenesEquivalent(currentScene, cachedScene)) {
 *   // Reuse cached soundscape
 *   return cachedSoundscape;
 * }
 * ```
 */
export function areScenesEquivalent(
  analysis1: SceneAnalysis,
  analysis2: SceneAnalysis,
  threshold: number = 0.85
): boolean {
  const similarity = calculateSimilarityScore(analysis1, analysis2);
  return similarity >= threshold;
}
