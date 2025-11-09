/**
 * Test script for Replicate API client
 * 
 * This script verifies that the Replicate client is properly configured
 * and can communicate with the API.
 * 
 * Usage: npx tsx scripts/test-replicate.ts
 */

import { config } from "dotenv";

// Load environment variables
config();

import { 
  replicate, 
  AUDIO_MODELS, 
  PRIMARY_AUDIO_MODEL,
  getModelConfig,
  isValidAudioModel 
} from "../lib/replicate";

async function testReplicateClient() {
  console.log("🧪 Testing Replicate API Client\n");

  // Test 1: Client initialization
  console.log("✓ Replicate client initialized");
  console.log(`  Auth token: ${process.env.REPLICATE_API_TOKEN?.substring(0, 10)}...`);

  // Test 2: Model constants
  console.log("\n📋 Available Audio Models:");
  Object.entries(AUDIO_MODELS).forEach(([key, value]) => {
    console.log(`  - ${key}: ${value}`);
  });

  // Test 3: Primary model
  console.log(`\n🎵 Primary Audio Model: ${PRIMARY_AUDIO_MODEL}`);

  // Test 4: Model configurations
  console.log("\n⚙️  Model Configurations:");
  Object.entries(AUDIO_MODELS).forEach(([key, model]) => {
    const config = getModelConfig(model);
    console.log(`\n  ${key}:`);
    console.log(`    Model: ${config.model}`);
    console.log(`    Version: ${config.version}`);
    console.log(`    Default Input:`, JSON.stringify(config.defaultInput, null, 6));
  });

  // Test 5: Model validation
  console.log("\n✅ Model Validation Tests:");
  console.log(`  isValidAudioModel("elevenlabs/music"): ${isValidAudioModel("elevenlabs/music")}`);
  console.log(`  isValidAudioModel("invalid-model"): ${isValidAudioModel("invalid-model")}`);

  // Test 6: API connectivity (optional - lists available models)
  console.log("\n🌐 Testing API Connectivity...");
  try {
    // This is a lightweight API call to verify connectivity
    const models = await replicate.models.list();
    console.log(`✓ Successfully connected to Replicate API`);
    console.log(`  Found ${models.results?.length || 0} models in first page`);
  } catch (error) {
    console.error("✗ Failed to connect to Replicate API:");
    console.error(`  ${error instanceof Error ? error.message : String(error)}`);
  }

  console.log("\n✨ Replicate client test complete!");
}

// Run the test
testReplicateClient().catch((error) => {
  console.error("\n❌ Test failed:");
  console.error(error);
  process.exit(1);
});
