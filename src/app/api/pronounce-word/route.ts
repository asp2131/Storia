import { NextRequest, NextResponse } from "next/server";
import Replicate from "replicate";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { word } = body;

    // Validate input
    if (!word || typeof word !== "string") {
      return NextResponse.json(
        { error: "Word is required and must be a string" },
        { status: 400 }
      );
    }

    const trimmedWord = word.trim();

    if (trimmedWord.length === 0 || trimmedWord.length > 50) {
      return NextResponse.json(
        { error: "Word must be between 1 and 50 characters" },
        { status: 400 }
      );
    }

    // Initialize Replicate client
    const apiToken = process.env.REPLICATE_API_TOKEN || process.env.REPLICATE_KEY;

    if (!apiToken) {
      return NextResponse.json(
        { error: "Replicate API token not configured" },
        { status: 500 }
      );
    }

    const replicate = new Replicate({ auth: apiToken });

    // Call ElevenLabs v3 on Replicate
    const output = await replicate.run("elevenlabs/v3", {
      input: {
        text: trimmedWord,
        prompt: trimmedWord,
        voice: "Reginald",
        stability: 0.5,
        similarity_boost: 0.75,
        style: 0.76,
        speed: 0.90,
      },
    });

    // Extract audio URL from output — handle various output formats
    let audioUrl: string | null = null;

    if (typeof output === "string") {
      audioUrl = output;
    } else if (output instanceof URL) {
      audioUrl = output.href;
    } else if (
      output &&
      typeof output === "object" &&
      "url" in output &&
      typeof (output as { url: unknown }).url === "function"
    ) {
      // FileOutput object — call .url() to get the string
      audioUrl = String((output as { url: () => string }).url());
    } else if (
      output &&
      typeof output === "object" &&
      "url" in output &&
      typeof (output as { url: unknown }).url === "string"
    ) {
      audioUrl = (output as { url: string }).url;
    } else if (output && typeof output === "object" && "href" in output) {
      audioUrl = String((output as { href: string }).href);
    } else if (typeof output === "object" && output !== null) {
      // Last resort: try to convert to string
      const str = String(output);
      if (str.startsWith("http")) {
        audioUrl = str;
      }
    }

    if (!audioUrl) {
      return NextResponse.json(
        { error: "Failed to extract audio URL from Replicate output" },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: audioUrl });
  } catch (error) {
    console.error("Error in pronounce-word API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
