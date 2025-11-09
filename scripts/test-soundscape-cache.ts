/**
 * Test script for soundscape caching system
 * 
 * Tests the cache lookup, key generation, and statistics functions.
 * Run with: npx tsx scripts/test-soundscape-cache.ts
 */

import {
  generateCacheKey,
  findCachedSoundscape,
  getCacheStats,
  validateCacheIntegrity,
} from "../lib/soundscapeCache";
import type { SceneAnalysis } from "../lib/analyzeContent";

async function testCacheKeyGeneration() {
  console.log("\n🔑 Testing Cache Key Generation");
  console.log("================================\n");

  const testScenes: SceneAnalysis[] = [
    {
      setting: "Dark Forest",
      mood: "Tense",
      intensity: "high",
      actions: ["walking", "listening"],
      audioPrompt: "Rustling leaves and distant animal calls in a dark forest",
    },
    {
      setting: "dark forest",
      mood: "tense",
      intensity: "high",
      actions: ["running"],
      audioPrompt: "Different prompt but same key",
    },
    {
      setting: "Busy City Street",
      mood: "Energetic",
      intensity: "medium",
      actions: ["walking", "talking"],
      audioPrompt: "Traffic sounds and crowd chatter",
    },
  ];

  for (const scene of testScenes) {
    const key = generateCacheKey(scene);
    console.log(`Setting: "${scene.setting}"`);
    console.log(`Mood: "${scene.mood}"`);
    console.log(`Intensity: "${scene.intensity}"`);
    console.log(`Cache Key: "${key}"`);
    console.log();
  }

  // Test that normalization works
  const key1 = generateCacheKey(testScenes[0]);
  const key2 = generateCacheKey(testScenes[1]);
  
  if (key1 === key2) {
    console.log("✅ Cache key normalization works correctly");
    console.log(`   Both scenes produce key: "${key1}"`);
  } else {
    console.log("❌ Cache key normalization failed");
    console.log(`   Key 1: "${key1}"`);
    console.log(`   Key 2: "${key2}"`);
  }
}

async function testCacheLookup() {
  console.log("\n🔍 Testing Cache Lookup");
  console.log("=======================\n");

  const testScene: SceneAnalysis = {
    setting: "Dark Forest",
    mood: "Mysterious",
    intensity: "medium",
    actions: ["exploring"],
    audioPrompt: "Ambient forest sounds with mysterious undertones",
  };

  console.log("Searching for cached soundscape...");
  console.log(`Setting: ${testScene.setting}`);
  console.log(`Mood: ${testScene.mood}`);
  console.log(`Intensity: ${testScene.intensity}`);
  console.log();

  try {
    const cached = await findCachedSoundscape(testScene);

    if (cached) {
      console.log("✅ Found cached soundscape!");
      console.log(`   ID: ${cached.id}`);
      console.log(`   Audio URL: ${cached.audioUrl}`);
      console.log(`   Duration: ${cached.duration}s`);
      console.log(`   Prompt: ${cached.generationPrompt}`);
    } else {
      console.log("ℹ️  No cached soundscape found (this is expected for a new database)");
      console.log("   A new soundscape would need to be generated");
    }
  } catch (error) {
    console.error("❌ Error during cache lookup:", error);
  }
}

async function testCacheStats() {
  console.log("\n📊 Testing Cache Statistics");
  console.log("===========================\n");

  try {
    const stats = await getCacheStats();

    console.log("Cache Statistics:");
    console.log(`  Total Soundscapes: ${stats.totalSoundscapes}`);
    console.log(`  Total Scenes: ${stats.totalScenes}`);
    console.log(`  Unique Cache Keys: ${stats.uniqueCacheKeys}`);
    console.log(`  Average Reuse: ${stats.averageSoundscapesPerKey}x`);
    console.log();

    if (stats.totalSoundscapes === 0) {
      console.log("ℹ️  No soundscapes in database yet");
      console.log("   Upload and process a book to populate the cache");
    } else {
      const hitRate = stats.uniqueCacheKeys > 0 
        ? ((stats.totalScenes - stats.uniqueCacheKeys) / stats.totalScenes * 100).toFixed(1)
        : 0;
      console.log(`📈 Estimated cache hit rate: ${hitRate}%`);
    }
  } catch (error) {
    console.error("❌ Error getting cache stats:", error);
  }
}

async function testCacheIntegrity() {
  console.log("\n🔧 Testing Cache Integrity");
  console.log("==========================\n");

  try {
    const invalid = await validateCacheIntegrity();

    if (invalid.length === 0) {
      console.log("✅ All soundscapes have valid audio URLs");
    } else {
      console.log(`⚠️  Found ${invalid.length} invalid soundscape(s):`);
      for (const id of invalid) {
        console.log(`   - ${id}`);
      }
    }
  } catch (error) {
    console.error("❌ Error validating cache integrity:", error);
  }
}

async function testCacheWorkflow() {
  console.log("\n🔄 Testing Complete Cache Workflow");
  console.log("==================================\n");

  const scene1: SceneAnalysis = {
    setting: "Peaceful Garden",
    mood: "Calm",
    intensity: "low",
    actions: ["sitting", "reading"],
    audioPrompt: "Gentle breeze and bird songs in a peaceful garden",
  };

  const scene2: SceneAnalysis = {
    setting: "Peaceful Garden",
    mood: "Calm",
    intensity: "low",
    actions: ["walking"],
    audioPrompt: "Different actions but same setting/mood/intensity",
  };

  console.log("Scenario: Processing two similar scenes");
  console.log();

  // First scene
  console.log("Scene 1:");
  console.log(`  Setting: ${scene1.setting}`);
  console.log(`  Mood: ${scene1.mood}`);
  console.log(`  Intensity: ${scene1.intensity}`);
  
  const key1 = generateCacheKey(scene1);
  console.log(`  Cache Key: ${key1}`);
  
  const cached1 = await findCachedSoundscape(scene1);
  console.log(`  Cache Result: ${cached1 ? "HIT ✅" : "MISS ❌"}`);
  console.log();

  // Second scene
  console.log("Scene 2:");
  console.log(`  Setting: ${scene2.setting}`);
  console.log(`  Mood: ${scene2.mood}`);
  console.log(`  Intensity: ${scene2.intensity}`);
  
  const key2 = generateCacheKey(scene2);
  console.log(`  Cache Key: ${key2}`);
  
  const cached2 = await findCachedSoundscape(scene2);
  console.log(`  Cache Result: ${cached2 ? "HIT ✅" : "MISS ❌"}`);
  console.log();

  // Analysis
  if (key1 === key2) {
    console.log("✅ Both scenes produce the same cache key");
    console.log("   They would share the same soundscape");
  } else {
    console.log("❌ Scenes produce different cache keys");
  }

  if (cached1 && cached2 && cached1.id === cached2.id) {
    console.log("✅ Both scenes would use the same cached soundscape");
    console.log(`   Soundscape ID: ${cached1.id}`);
  } else if (!cached1 && !cached2) {
    console.log("ℹ️  No cached soundscapes found for either scene");
    console.log("   First scene would generate, second would reuse");
  }
}

async function main() {
  console.log("╔════════════════════════════════════════════╗");
  console.log("║  Soundscape Caching System Test Suite     ║");
  console.log("╚════════════════════════════════════════════╝");

  try {
    await testCacheKeyGeneration();
    await testCacheLookup();
    await testCacheStats();
    await testCacheIntegrity();
    await testCacheWorkflow();

    console.log("\n✅ All tests completed!");
    console.log("\nNext Steps:");
    console.log("1. Upload a PDF book to populate the database");
    console.log("2. Process the book to generate soundscapes");
    console.log("3. Run this test again to see cache statistics");
    console.log("4. Upload another book to see cache reuse in action");
  } catch (error) {
    console.error("\n❌ Test suite failed:", error);
    process.exit(1);
  }
}

main();
