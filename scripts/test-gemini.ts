/**
 * Test script for Gemini API client
 * Run with: npx tsx scripts/test-gemini.ts
 */

import "dotenv/config";
import { analyzePageContent } from "@/lib/gemini";

const sampleText = `
The old mansion stood at the edge of the cliff, its windows dark and empty. 
A cold wind howled through the bare trees, carrying with it the scent of rain. 
Sarah approached cautiously, her footsteps crunching on the gravel path. 
Thunder rumbled in the distance as storm clouds gathered overhead.
`;

async function testGemini() {
  console.log("Testing Gemini API client...\n");
  console.log("Sample text:", sampleText);
  console.log("\nAnalyzing...\n");

  try {
    const analysis = await analyzePageContent(sampleText, 1);
    
    console.log("✅ Analysis successful!\n");
    console.log("Results:");
    console.log(JSON.stringify(analysis, null, 2));
    
    console.log("\n✅ All tests passed!");
  } catch (error) {
    console.error("❌ Test failed:", error);
    process.exit(1);
  }
}

testGemini();
