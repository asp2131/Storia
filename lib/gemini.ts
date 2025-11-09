import Replicate from "replicate";

// Initialize Replicate client
const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

// Gemini model configuration
const GEMINI_MODEL = "google/gemini-2.5-flash";

/**
 * Scene analysis result from Gemini
 */
export interface SceneAnalysis {
  setting: string;
  mood: string;
  weather?: string;
  timeOfDay?: string;
  intensity: "low" | "medium" | "high";
  actions: string[];
  audioPrompt: string;
}

/**
 * Analyze page content using Gemini Flash via Replicate
 * Extracts narrative elements for soundscape generation
 */
export async function analyzePageContent(
  pageText: string,
  pageNumber: number
): Promise<SceneAnalysis> {
  if (!process.env.REPLICATE_API_TOKEN) {
    throw new Error("REPLICATE_API_TOKEN is not configured");
  }

  if (!pageText || pageText.trim().length === 0) {
    throw new Error("Page text is empty");
  }

  const prompt = `Analyze the following page from a book and extract narrative elements for audio soundscape generation.

Page ${pageNumber}:
${pageText}

Provide a JSON response with the following structure:
{
  "setting": "Brief description of the physical location/environment",
  "mood": "Overall emotional tone (e.g., tense, peaceful, mysterious, joyful)",
  "weather": "Weather conditions if mentioned (e.g., rainy, sunny, stormy) or null",
  "timeOfDay": "Time of day if mentioned (e.g., dawn, night, afternoon) or null",
  "intensity": "Narrative intensity level: low, medium, or high",
  "actions": ["List", "of", "key", "actions", "or", "events"],
  "audioPrompt": "A 1-2 sentence description for generating ambient soundscape audio that captures the scene's atmosphere"
}

Focus on elements that would translate well to ambient audio. The audioPrompt should describe the sonic environment, not the narrative.`;

  try {
    const output = await replicate.run(GEMINI_MODEL, {
      input: {
        prompt: prompt,
      },
    });

    // Replicate returns output as an array or string
    let responseText: string;
    if (Array.isArray(output)) {
      responseText = output.join("");
    } else if (typeof output === "string") {
      responseText = output;
    } else {
      throw new Error("Unexpected output format from Gemini");
    }

    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = responseText.match(/```json\n?([\s\S]*?)\n?```/) || 
                     responseText.match(/\{[\s\S]*\}/);
    
    if (!jsonMatch) {
      throw new Error("Could not extract JSON from Gemini response");
    }

    const jsonText = jsonMatch[1] || jsonMatch[0];
    const analysis = JSON.parse(jsonText) as SceneAnalysis;

    // Validate required fields
    if (!analysis.setting || !analysis.mood || !analysis.intensity || !analysis.audioPrompt) {
      throw new Error("Gemini response missing required fields");
    }

    // Validate intensity value
    if (!["low", "medium", "high"].includes(analysis.intensity)) {
      analysis.intensity = "medium"; // Default fallback
    }

    // Ensure actions is an array
    if (!Array.isArray(analysis.actions)) {
      analysis.actions = [];
    }

    return analysis;
  } catch (error) {
    console.error("Error analyzing content with Gemini:", error);
    
    if (error instanceof Error) {
      throw new Error(`Gemini analysis failed: ${error.message}`);
    }
    
    throw new Error("Gemini analysis failed with unknown error");
  }
}

/**
 * Analyze multiple pages in batch for efficiency
 * Useful for processing page spreads (2 pages at a time)
 */
export async function analyzePageSpread(
  page1Text: string,
  page2Text: string,
  startPageNumber: number
): Promise<SceneAnalysis> {
  const combinedText = `${page1Text}\n\n${page2Text}`;
  return analyzePageContent(combinedText, startPageNumber);
}

/**
 * Retry wrapper with exponential backoff
 */
export async function analyzeWithRetry(
  pageText: string,
  pageNumber: number,
  maxRetries: number = 3
): Promise<SceneAnalysis> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await analyzePageContent(pageText, pageNumber);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Unknown error");
      
      if (attempt < maxRetries - 1) {
        // Exponential backoff: 1s, 2s, 4s
        const delayMs = Math.pow(2, attempt) * 1000;
        console.log(`Retry attempt ${attempt + 1} after ${delayMs}ms delay`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  throw lastError || new Error("Analysis failed after retries");
}
