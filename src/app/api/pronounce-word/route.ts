import { NextRequest, NextResponse } from "next/server";
import {
  resolveElevenLabsVoice,
  synthesizeSpeech,
} from "@/lib/elevenlabs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { word } = body;

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

    const { voiceId } = await resolveElevenLabsVoice();
    const { audioBuffer, contentType } = await synthesizeSpeech({
      text: trimmedWord,
      voiceId,
      speed: 0.9,
    });

    const base64 = audioBuffer.toString("base64");
    const audioUrl = `data:${contentType};base64,${base64}`;

    return NextResponse.json({ url: audioUrl });
  } catch (error) {
    console.error("Error in pronounce-word API:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
