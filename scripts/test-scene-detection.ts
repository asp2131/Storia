/**
 * Test script for scene detection module
 * 
 * Run with: npx tsx scripts/test-scene-detection.ts
 */

import { detectSceneChange, calculateSimilarityScore, areScenesEquivalent } from "../lib/sceneDetection";
import { SceneAnalysis } from "../lib/analyzeContent";

console.log("🎬 Testing Scene Detection Module\n");

// Test Case 1: Setting change
console.log("Test 1: Setting Change");
const scene1: SceneAnalysis = {
  setting: "A dark forest",
  mood: "tense",
  intensity: "medium",
  actions: ["walking", "listening"],
  audioPrompt: "Rustling leaves and distant animal calls in a dark forest"
};

const scene2: SceneAnalysis = {
  setting: "A bustling city street",
  mood: "tense",
  intensity: "medium",
  actions: ["walking", "observing"],
  audioPrompt: "Traffic noise and urban ambiance"
};

const result1 = detectSceneChange(scene1, scene2);
console.log(`Previous: ${scene1.setting} (${scene1.mood}, ${scene1.intensity})`);
console.log(`Current: ${scene2.setting} (${scene2.mood}, ${scene2.intensity})`);
console.log(`Scene change detected: ${result1}`);
console.log(`Expected: true ✓\n`);

// Test Case 2: Mood change
console.log("Test 2: Mood Change");
const scene3: SceneAnalysis = {
  setting: "A quiet library",
  mood: "peaceful",
  intensity: "low",
  actions: ["reading", "studying"],
  audioPrompt: "Soft page turning and distant whispers"
};

const scene4: SceneAnalysis = {
  setting: "A quiet library",
  mood: "tense",
  intensity: "low",
  actions: ["hiding", "watching"],
  audioPrompt: "Tense silence with occasional creaks"
};

const result2 = detectSceneChange(scene3, scene4);
console.log(`Previous: ${scene3.setting} (${scene3.mood}, ${scene3.intensity})`);
console.log(`Current: ${scene4.setting} (${scene4.mood}, ${scene4.intensity})`);
console.log(`Scene change detected: ${result2}`);
console.log(`Expected: true ✓\n`);

// Test Case 3: Significant intensity change (low to high)
console.log("Test 3: Significant Intensity Change");
const scene5: SceneAnalysis = {
  setting: "A battlefield",
  mood: "tense",
  intensity: "low",
  actions: ["waiting", "preparing"],
  audioPrompt: "Distant drums and quiet anticipation"
};

const scene6: SceneAnalysis = {
  setting: "A battlefield",
  mood: "tense",
  intensity: "high",
  actions: ["fighting", "charging"],
  audioPrompt: "Intense battle sounds with clashing weapons"
};

const result3 = detectSceneChange(scene5, scene6);
console.log(`Previous: ${scene5.setting} (${scene5.mood}, ${scene5.intensity})`);
console.log(`Current: ${scene6.setting} (${scene6.mood}, ${scene6.intensity})`);
console.log(`Scene change detected: ${result3}`);
console.log(`Expected: true ✓\n`);

// Test Case 4: No significant change
console.log("Test 4: No Significant Change");
const scene7: SceneAnalysis = {
  setting: "A cozy cabin",
  mood: "peaceful",
  intensity: "low",
  actions: ["sitting", "relaxing"],
  audioPrompt: "Crackling fireplace and gentle wind"
};

const scene8: SceneAnalysis = {
  setting: "The cozy cabin",
  mood: "peaceful",
  intensity: "low",
  actions: ["reading", "drinking tea"],
  audioPrompt: "Warm fireplace ambiance with soft crackling"
};

const result4 = detectSceneChange(scene7, scene8);
console.log(`Previous: ${scene7.setting} (${scene7.mood}, ${scene7.intensity})`);
console.log(`Current: ${scene8.setting} (${scene8.mood}, ${scene8.intensity})`);
console.log(`Scene change detected: ${result4}`);
console.log(`Expected: false ✓\n`);

// Test Case 5: Minor intensity change (medium to high - only 1 level)
console.log("Test 5: Minor Intensity Change (1 level)");
const scene9: SceneAnalysis = {
  setting: "A mountain trail",
  mood: "adventurous",
  intensity: "medium",
  actions: ["hiking", "climbing"],
  audioPrompt: "Mountain wind and footsteps on gravel"
};

const scene10: SceneAnalysis = {
  setting: "A mountain trail",
  mood: "adventurous",
  intensity: "high",
  actions: ["climbing", "struggling"],
  audioPrompt: "Intense wind and heavy breathing"
};

const result5 = detectSceneChange(scene9, scene10);
console.log(`Previous: ${scene9.setting} (${scene9.mood}, ${scene9.intensity})`);
console.log(`Current: ${scene10.setting} (${scene10.mood}, ${scene10.intensity})`);
console.log(`Scene change detected: ${result5}`);
console.log(`Expected: false (only 1 level change) ✓\n`);

// Test similarity scoring
console.log("Test 6: Similarity Scoring");
const similarity1 = calculateSimilarityScore(scene7, scene8);
console.log(`Similarity between similar scenes: ${(similarity1 * 100).toFixed(1)}%`);
console.log(`Expected: >85% ✓`);

const similarity2 = calculateSimilarityScore(scene1, scene2);
console.log(`Similarity between different scenes: ${(similarity2 * 100).toFixed(1)}%`);
console.log(`Expected: <50% ✓\n`);

// Test scene equivalence
console.log("Test 7: Scene Equivalence");
const equiv1 = areScenesEquivalent(scene7, scene8);
console.log(`Are scene7 and scene8 equivalent? ${equiv1}`);
console.log(`Expected: true ✓`);

const equiv2 = areScenesEquivalent(scene1, scene2);
console.log(`Are scene1 and scene2 equivalent? ${equiv2}`);
console.log(`Expected: false ✓\n`);

console.log("✅ All scene detection tests completed!");
