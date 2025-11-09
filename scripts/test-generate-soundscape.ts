/**
 * Test script for soundscape generation module
 * 
 * Tests both simple and polling-based generation methods
 * 
 * Usage:
 *   npx tsx scripts/test-generate-soundscape.ts
 */

import {
  generateSoundscape,
  generateSoundscapeWithPolling,
  generateSoundscapeWithRetry,
  validateSceneAnalysis,
  estimateGenerationCost,
} from "../lib/generateSoundscape";
import type { SceneAnalysis } from "../lib/analyzeContent";

// Test scene analysis
const testScenes: Array<{ name: string; analysis: SceneAnalysis }> = [
  {
    name: "Dark Forest",
    analysis: {
      setting: "A dark forest at night",
      mood: "mysterious and tense",
      weather: "foggy",
      timeOfDay: "night",
      intensity: "medium",
      actions: ["walking", "listening", "searching"],
      audioPrompt:
        "Dark forest ambience with rustling leaves, distant owl hoots, subtle wind through trees, and occasional branch snaps",
    },
  },
  {
    name: "Peaceful Meadow",
    analysis: {
      setting: "A sunny meadow with wildflowers",
      mood: "peaceful and serene",
      weather: "sunny",
      timeOfDay: "afternoon",
      intensity: "low",
      actions: ["resting", "observing"],
      audioPrompt:
        "Gentle meadow sounds with birds chirping, soft breeze, buzzing bees, and distant stream flowing",
    },
  },
  {
    name: "Stormy Ocean",
    analysis: {
      setting: "A ship on a stormy ocean",
      mood: "intense and dramatic",
      weather: "stormy",
      timeOfDay: "dusk",
      intensity: "high",
      actions: ["battling", "struggling", "shouting"],
      audioPrompt:
        "Intense storm with crashing waves, howling wind, thunder rumbles, creaking ship wood, and rain pelting",
    },
  },
];

async function testValidation() {
  console.log("\n🧪 Testing Scene Analysis Validation...\n");

  // Test valid analysis
  try {
    validateSceneAnalysis(testScenes[0].analysis);
    console.log("✅ Valid scene analysis passed validation");
  } catch (error) {
    console.error("❌ Valid scene failed validation:", error);
  }

  // Test invalid analysis (missing audio prompt)
  try {
    const invalidAnalysis = {
      ...testScenes[0].analysis,
      audioPrompt: "",
    };
    validateSceneAnalysis(invalidAnalysis);
    console.error("❌ Invalid scene passed validation (should have failed)");
  } catch (error) {
    console.log("✅ Invalid scene correctly rejected:", (error as Error).message);
  }

  // Test invalid intensity
  try {
    const invalidAnalysis = {
      ...testScenes[0].analysis,
      intensity: "extreme" as any,
    };
    validateSceneAnalysis(invalidAnalysis);
    console.error("❌ Invalid intensity passed validation (should have failed)");
  } catch (error) {
    console.log("✅ Invalid intensity correctly rejected:", (error as Error).message);
  }
}

async function testCostEstimation() {
  console.log("\n💰 Testing Cost Estimation...\n");

  const testCases = [
    { scenes: 10, expected: 0.5 },
    { scenes: 50, expected: 2.5 },
    { scenes: 150, expected: 7.5 },
  ];

  for (const testCase of testCases) {
    const cost = estimateGenerationCost(testCase.scenes);
    console.log(
      `${testCase.scenes} scenes: $${cost.toFixed(2)} (expected: $${testCase.expected.toFixed(2)})`
    );
    
    if (Math.abs(cost - testCase.expected) < 0.01) {
      console.log("✅ Cost estimation correct");
    } else {
      console.error("❌ Cost estimation incorrect");
    }
  }
}

async function testSimpleGeneration() {
  console.log("\n🎵 Testing Simple Generation (replicate.run)...\n");

  const scene = testScenes[0];
  console.log(`Testing scene: ${scene.name}`);
  console.log(`Prompt: ${scene.analysis.audioPrompt}\n`);

  try {
    const startTime = Date.now();
    const result = await generateSoundscape(
      scene.analysis,
      `test-simple-${Date.now()}`
    );
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log("\n✅ Simple generation successful!");
    console.log(`⏱️  Total time: ${duration}s`);
    console.log(`📊 Result:`);
    console.log(`   - Audio URL: ${result.audioUrl}`);
    console.log(`   - Duration: ${result.duration}s`);
    console.log(`   - Prediction ID: ${result.predictionId}`);
    console.log(`   - Prompt: ${result.prompt}`);
    if (result.replicateUrl) {
      console.log(`   - Replicate URL: ${result.replicateUrl}`);
    }

    return result;
  } catch (error) {
    console.error("\n❌ Simple generation failed:");
    console.error(error);
    throw error;
  }
}

async function testPollingGeneration() {
  console.log("\n🔄 Testing Polling Generation (predictions API)...\n");

  const scene = testScenes[1];
  console.log(`Testing scene: ${scene.name}`);
  console.log(`Prompt: ${scene.analysis.audioPrompt}\n`);

  try {
    const startTime = Date.now();
    const result = await generateSoundscapeWithPolling(
      scene.analysis,
      `test-polling-${Date.now()}`,
      300 // 5 minute timeout
    );
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log("\n✅ Polling generation successful!");
    console.log(`⏱️  Total time: ${duration}s`);
    console.log(`📊 Result:`);
    console.log(`   - Audio URL: ${result.audioUrl}`);
    console.log(`   - Duration: ${result.duration}s`);
    console.log(`   - Prediction ID: ${result.predictionId}`);
    console.log(`   - Prompt: ${result.prompt}`);
    if (result.replicateUrl) {
      console.log(`   - Replicate URL: ${result.replicateUrl}`);
    }

    return result;
  } catch (error) {
    console.error("\n❌ Polling generation failed:");
    console.error(error);
    throw error;
  }
}

async function testRetryGeneration() {
  console.log("\n🔁 Testing Generation with Retry Logic...\n");

  const scene = testScenes[2];
  console.log(`Testing scene: ${scene.name}`);
  console.log(`Prompt: ${scene.analysis.audioPrompt}\n`);

  try {
    const startTime = Date.now();
    const result = await generateSoundscapeWithRetry(
      scene.analysis,
      `test-retry-${Date.now()}`,
      3 // Max 3 retries
    );
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log("\n✅ Retry generation successful!");
    console.log(`⏱️  Total time: ${duration}s`);
    console.log(`📊 Result:`);
    console.log(`   - Audio URL: ${result.audioUrl}`);
    console.log(`   - Duration: ${result.duration}s`);
    console.log(`   - Prediction ID: ${result.predictionId}`);
    console.log(`   - Prompt: ${result.prompt}`);

    return result;
  } catch (error) {
    console.error("\n❌ Retry generation failed:");
    console.error(error);
    throw error;
  }
}

async function main() {
  console.log("🎵 Soundscape Generation Module Test Suite");
  console.log("==========================================");

  try {
    // Test validation
    await testValidation();

    // Test cost estimation
    await testCostEstimation();

    // Choose which generation method to test
    const testMethod = process.argv[2] || "simple";

    switch (testMethod) {
      case "simple":
        await testSimpleGeneration();
        break;
      case "polling":
        await testPollingGeneration();
        break;
      case "retry":
        await testRetryGeneration();
        break;
      case "all":
        await testSimpleGeneration();
        await testPollingGeneration();
        await testRetryGeneration();
        break;
      default:
        console.log("\n⚠️  Unknown test method. Use: simple, polling, retry, or all");
        console.log("   Example: npx tsx scripts/test-generate-soundscape.ts polling");
        process.exit(1);
    }

    console.log("\n✅ All tests completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Test suite failed:");
    console.error(error);
    process.exit(1);
  }
}

// Run tests
main();
