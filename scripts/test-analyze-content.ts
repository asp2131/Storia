/**
 * Test script for Content Analysis Module
 * Run with: npx tsx scripts/test-analyze-content.ts
 */

import "dotenv/config";
import {
  analyzePageContent,
  analyzePageSpread,
  analyzeWithRetry,
  analyzePageSpreadWithRetry,
} from "@/lib/analyzeContent";

const samplePage1 = `
The old mansion stood at the edge of the cliff, its windows dark and empty. 
A cold wind howled through the bare trees, carrying with it the scent of rain. 
Sarah approached cautiously, her footsteps crunching on the gravel path.
`;

const samplePage2 = `
Thunder rumbled in the distance as storm clouds gathered overhead.
She reached for the rusted door handle, her heart pounding in her chest.
The door creaked open, revealing a dusty entrance hall shrouded in shadows.
`;

async function testContentAnalysis() {
  console.log("🧪 Testing Content Analysis Module\n");
  console.log("=" .repeat(60));

  // Test 1: Single page analysis
  console.log("\n📄 Test 1: Single Page Analysis");
  console.log("-".repeat(60));
  console.log("Sample text:", samplePage1.trim());
  console.log("\nAnalyzing...");

  try {
    const analysis1 = await analyzePageContent(samplePage1, 1);
    console.log("\n✅ Single page analysis successful!");
    console.log(JSON.stringify(analysis1, null, 2));
  } catch (error) {
    console.error("\n❌ Single page analysis failed:", error);
    process.exit(1);
  }

  // Test 2: Page spread analysis
  console.log("\n\n📖 Test 2: Page Spread Analysis");
  console.log("-".repeat(60));
  console.log("Page 1:", samplePage1.trim());
  console.log("\nPage 2:", samplePage2.trim());
  console.log("\nAnalyzing spread...");

  try {
    const analysis2 = await analyzePageSpread(samplePage1, samplePage2, 1);
    console.log("\n✅ Page spread analysis successful!");
    console.log(JSON.stringify(analysis2, null, 2));
  } catch (error) {
    console.error("\n❌ Page spread analysis failed:", error);
    process.exit(1);
  }

  // Test 3: Analysis with retry
  console.log("\n\n🔄 Test 3: Analysis with Retry Logic");
  console.log("-".repeat(60));
  console.log("Testing retry mechanism with valid content...");

  try {
    const analysis3 = await analyzeWithRetry(samplePage1, 1, 3);
    console.log("\n✅ Retry analysis successful!");
    console.log("Setting:", analysis3.setting);
    console.log("Mood:", analysis3.mood);
    console.log("Intensity:", analysis3.intensity);
    console.log("Audio Prompt:", analysis3.audioPrompt);
  } catch (error) {
    console.error("\n❌ Retry analysis failed:", error);
    process.exit(1);
  }

  // Test 4: Page spread with retry
  console.log("\n\n🔄 Test 4: Page Spread with Retry Logic");
  console.log("-".repeat(60));
  console.log("Testing retry mechanism with page spread...");

  try {
    const analysis4 = await analyzePageSpreadWithRetry(
      samplePage1,
      samplePage2,
      1,
      3
    );
    console.log("\n✅ Page spread retry analysis successful!");
    console.log("Setting:", analysis4.setting);
    console.log("Mood:", analysis4.mood);
    console.log("Intensity:", analysis4.intensity);
    console.log("Audio Prompt:", analysis4.audioPrompt);
  } catch (error) {
    console.error("\n❌ Page spread retry analysis failed:", error);
    process.exit(1);
  }

  // Test 5: Error handling - empty text
  console.log("\n\n⚠️  Test 5: Error Handling - Empty Text");
  console.log("-".repeat(60));

  try {
    await analyzePageContent("", 1);
    console.error("\n❌ Should have thrown error for empty text!");
    process.exit(1);
  } catch (error) {
    console.log("\n✅ Correctly handled empty text error:");
    console.log("   ", (error as Error).message);
  }

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("✅ All tests passed!");
  console.log("=".repeat(60));
  console.log("\n📊 Test Summary:");
  console.log("   ✓ Single page analysis");
  console.log("   ✓ Page spread analysis");
  console.log("   ✓ Retry logic");
  console.log("   ✓ Page spread retry logic");
  console.log("   ✓ Error handling");
  console.log("\n🎉 Content Analysis Module is working correctly!\n");
}

testContentAnalysis();
