import { NextResponse } from "next/server";
import { listElevenLabsVoices } from "@/lib/elevenlabs";

export async function GET() {
  try {
    if (!process.env.ELEVENLABS_API_KEY) {
      return NextResponse.json(
        { error: "Missing ELEVENLABS_API_KEY in environment." },
        { status: 500 }
      );
    }

    const voices = await listElevenLabsVoices();
    const normalized = voices.map((voice) => ({
      id: voice.voice_id,
      name: voice.name,
      category: voice.category || null,
    }));

    return NextResponse.json({ voices: normalized });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch ElevenLabs voices.",
      },
      { status: 500 }
    );
  }
}
