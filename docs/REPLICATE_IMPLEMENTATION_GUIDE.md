# Replicate API Implementation Guide
## Immersive Reading Platform - Soundscape Generation

### Overview
This guide covers the integration of Replicate API for AI-powered soundscape generation using ElevenLabs Music and other audio models.

---

## 1. Setup & Configuration

### Install Dependencies
```bash
npm install replicate
npm install @types/node  # For TypeScript support
```

### Environment Variables
```env
REPLICATE_API_TOKEN=r8_your_token_here
ANTHROPIC_API_KEY=sk-ant-your_key_here
DATABASE_URL=postgresql://user:pass@host:5432/dbname
CLOUDFLARE_R2_ACCESS_KEY=your_access_key
CLOUDFLARE_R2_SECRET_KEY=your_secret_key
CLOUDFLARE_R2_BUCKET=immersive-reading-audio
```

---

## 2. Replicate Client Setup

### lib/replicate.ts
```typescript
import Replicate from "replicate";

export const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN!,
});

// Available audio models
export const AUDIO_MODELS = {
  ELEVENLABS_MUSIC: "elevenlabs/music" as const,
  MUSICGEN: "meta/musicgen" as const,
  RIFFUSION: "riffusion/riffusion" as const,
  STABLE_AUDIO: "stability-ai/stable-audio" as const,
};

// Model configurations
export const MODEL_CONFIGS = {
  [AUDIO_MODELS.ELEVENLABS_MUSIC]: {
    defaultDuration: 30, // seconds
    outputFormat: "wav",
    quality: "high",
  },
  [AUDIO_MODELS.MUSICGEN]: {
    defaultDuration: 30,
    outputFormat: "wav",
    model_version: "large",
  },
};
```

---

## 3. Content Analysis with Claude

### lib/analyzeContent.ts
```typescript
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

export interface SceneAnalysis {
  setting: string;
  mood: string;
  weather?: string;
  timeOfDay?: string;
  intensity: "low" | "medium" | "high";
  actions: string[];
  audioPrompt: string;
}

export async function analyzePageContent(
  pageText: string,
  pageNumber: number
): Promise<SceneAnalysis> {
  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `Analyze this book page and extract elements for soundscape generation.

Page ${pageNumber}:
${pageText}

Provide a JSON response with:
- setting (location/environment)
- mood (emotional tone)
- weather (if mentioned)
- timeOfDay (if mentioned)
- intensity (low/medium/high activity level)
- actions (array of sounds/actions occurring)
- audioPrompt (detailed 1-2 sentence prompt for audio generation)

Focus on creating an immersive ambient soundscape that enhances reading without distraction.`,
      },
    ],
  });

  const content = message.content[0];
  if (content.type === "text") {
    // Extract JSON from Claude's response
    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  }

  throw new Error("Failed to parse scene analysis");
}

export async function detectSceneChange(
  previousAnalysis: SceneAnalysis,
  currentAnalysis: SceneAnalysis
): Promise<boolean> {
  // Scene changes if setting or mood changes significantly
  const settingChanged = previousAnalysis.setting !== currentAnalysis.setting;
  const moodChanged = previousAnalysis.mood !== currentAnalysis.mood;
  const intensityChanged =
    Math.abs(
      getIntensityValue(previousAnalysis.intensity) -
        getIntensityValue(currentAnalysis.intensity)
    ) >= 2;

  return settingChanged || moodChanged || intensityChanged;
}

function getIntensityValue(intensity: string): number {
  const map = { low: 1, medium: 2, high: 3 };
  return map[intensity as keyof typeof map] || 2;
}
```

---

## 4. Soundscape Generation with Replicate

### lib/generateSoundscape.ts
```typescript
import { replicate, AUDIO_MODELS } from "./replicate";
import { SceneAnalysis } from "./analyzeContent";
import { uploadToR2 } from "./storage";

export interface SoundscapeResult {
  audioUrl: string;
  duration: number;
  predictionId: string;
  prompt: string;
}

export async function generateSoundscape(
  sceneAnalysis: SceneAnalysis,
  sceneId: string
): Promise<SoundscapeResult> {
  console.log(`Generating soundscape for scene ${sceneId}`);
  console.log(`Prompt: ${sceneAnalysis.audioPrompt}`);

  try {
    // Run the ElevenLabs music model via Replicate
    const output = await replicate.run(AUDIO_MODELS.ELEVENLABS_MUSIC, {
      input: {
        prompt: sceneAnalysis.audioPrompt,
        music_length_ms: 30000, // 30 seconds
        output_format: "wav_cd_quality",
        force_instrumental: false, // Allow ambient vocals if appropriate
      },
    });

    // Output is a URL to the generated audio file
    const audioUrl = output as string;

    // Download and re-upload to our R2 storage for permanence
    const permanentUrl = await uploadToR2(audioUrl, sceneId);

    return {
      audioUrl: permanentUrl,
      duration: 30,
      predictionId: "", // Replicate doesn't expose prediction ID in run()
      prompt: sceneAnalysis.audioPrompt,
    };
  } catch (error) {
    console.error("Error generating soundscape:", error);
    throw error;
  }
}

export async function generateSoundscapeWithPolling(
  sceneAnalysis: SceneAnalysis,
  sceneId: string
): Promise<SoundscapeResult> {
  console.log(`Starting soundscape generation for scene ${sceneId}`);

  // For more control, use predictions API
  const prediction = await replicate.predictions.create({
    version:
      "67c3zsgx9rmc0ctch1sy526941prediction67c3zsgx9rmc0ctch1sy526941", // ElevenLabs music version
    input: {
      prompt: sceneAnalysis.audioPrompt,
      music_length_ms: 30000,
      output_format: "wav_cd_quality",
    },
  });

  console.log(`Prediction created: ${prediction.id}`);

  // Poll for completion
  let completedPrediction = await replicate.predictions.get(prediction.id);

  while (
    completedPrediction.status !== "succeeded" &&
    completedPrediction.status !== "failed"
  ) {
    await new Promise((resolve) => setTimeout(resolve, 2000)); // Poll every 2 seconds
    completedPrediction = await replicate.predictions.get(prediction.id);
    console.log(`Status: ${completedPrediction.status}`);
  }

  if (completedPrediction.status === "failed") {
    throw new Error(
      `Soundscape generation failed: ${completedPrediction.error}`
    );
  }

  const audioUrl = completedPrediction.output as string;
  const permanentUrl = await uploadToR2(audioUrl, sceneId);

  console.log(
    `Soundscape generated successfully: ${completedPrediction.id}`
  );

  return {
    audioUrl: permanentUrl,
    duration: 30,
    predictionId: completedPrediction.id,
    prompt: sceneAnalysis.audioPrompt,
  };
}
```

---

## 5. Storage Integration (Cloudflare R2)

### lib/storage.ts
```typescript
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import fetch from "node-fetch";

const s3Client = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY!,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_KEY!,
  },
});

export async function uploadToR2(
  sourceUrl: string,
  sceneId: string
): Promise<string> {
  // Download the audio file from Replicate
  const response = await fetch(sourceUrl);
  const audioBuffer = await response.arrayBuffer();

  const key = `soundscapes/${sceneId}.wav`;

  // Upload to R2
  await s3Client.send(
    new PutObjectCommand({
      Bucket: process.env.CLOUDFLARE_R2_BUCKET!,
      Key: key,
      Body: Buffer.from(audioBuffer),
      ContentType: "audio/wav",
    })
  );

  // Return public URL
  return `https://${process.env.CLOUDFLARE_R2_PUBLIC_DOMAIN}/${key}`;
}

export async function uploadPDFToR2(
  pdfBuffer: Buffer,
  bookId: string
): Promise<string> {
  const key = `books/${bookId}.pdf`;

  await s3Client.send(
    new PutObjectCommand({
      Bucket: process.env.CLOUDFLARE_R2_BUCKET!,
      Key: key,
      Body: pdfBuffer,
      ContentType: "application/pdf",
    })
  );

  return `https://${process.env.CLOUDFLARE_R2_PUBLIC_DOMAIN}/${key}`;
}
```

---

## 6. API Routes

### app/api/books/upload/route.ts
```typescript
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { uploadPDFToR2 } from "@/lib/storage";
import { db } from "@/lib/db";
import { extractPDFText } from "@/lib/pdfProcessor";

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("pdf") as File;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  // Convert to buffer
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Create book record
  const book = await db.book.create({
    data: {
      userId: session.user.id,
      title: file.name.replace(".pdf", ""),
      status: "processing",
    },
  });

  // Upload PDF to R2
  const pdfUrl = await uploadPDFToR2(buffer, book.id);

  // Update book with PDF URL
  await db.book.update({
    where: { id: book.id },
    data: { pdfUrl },
  });

  // Extract text (this could be done in a background job)
  const pages = await extractPDFText(buffer);

  // Save pages to database
  for (let i = 0; i < pages.length; i++) {
    await db.page.create({
      data: {
        bookId: book.id,
        pageNumber: i + 1,
        textContent: pages[i],
      },
    });
  }

  // Trigger soundscape generation (background job)
  await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/generate-soundscapes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bookId: book.id }),
  });

  return NextResponse.json({ book });
}
```

### app/api/generate-soundscapes/route.ts
```typescript
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { analyzePageContent, detectSceneChange } from "@/lib/analyzeContent";
import { generateSoundscape } from "@/lib/generateSoundscape";

export async function POST(request: NextRequest) {
  const { bookId } = await request.json();

  const book = await db.book.findUnique({
    where: { id: bookId },
    include: { pages: { orderBy: { pageNumber: "asc" } } },
  });

  if (!book) {
    return NextResponse.json({ error: "Book not found" }, { status: 404 });
  }

  let currentScene: any = null;
  let previousAnalysis: any = null;

  for (const page of book.pages) {
    // Analyze page content
    const analysis = await analyzePageContent(
      page.textContent,
      page.pageNumber
    );

    // Check if scene changed
    const sceneChanged =
      !previousAnalysis ||
      (await detectSceneChange(previousAnalysis, analysis));

    if (sceneChanged) {
      // Create new scene
      currentScene = await db.scene.create({
        data: {
          bookId: book.id,
          startPage: page.pageNumber,
          endPage: page.pageNumber,
          setting: analysis.setting,
          mood: analysis.mood,
          descriptors: JSON.stringify(analysis),
        },
      });

      // Generate soundscape
      try {
        const soundscape = await generateSoundscape(analysis, currentScene.id);

        await db.soundscape.create({
          data: {
            sceneId: currentScene.id,
            audioUrl: soundscape.audioUrl,
            duration: soundscape.duration,
            generationPrompt: soundscape.prompt,
            replicatePredictionId: soundscape.predictionId,
          },
        });
      } catch (error) {
        console.error(`Failed to generate soundscape for scene:`, error);
      }
    } else {
      // Extend current scene
      await db.scene.update({
        where: { id: currentScene.id },
        data: { endPage: page.pageNumber },
      });
    }

    // Update page with scene reference
    await db.page.update({
      where: { id: page.id },
      data: { sceneId: currentScene.id },
    });

    previousAnalysis = analysis;
  }

  // Mark book as processed
  await db.book.update({
    where: { id: bookId },
    data: { status: "ready" },
  });

  return NextResponse.json({ success: true });
}
```

---

## 7. Frontend Audio Player

### components/AudioPlayer.tsx
```typescript
"use client";

import { useEffect, useRef, useState } from "react";

interface AudioPlayerProps {
  soundscapeUrl: string;
  volume?: number;
  crossfadeDuration?: number;
}

export function AudioPlayer({
  soundscapeUrl,
  volume = 0.5,
  crossfadeDuration = 3,
}: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);

  useEffect(() => {
    // Initialize Web Audio API
    audioContextRef.current = new AudioContext();
    gainNodeRef.current = audioContextRef.current.createGain();
    gainNodeRef.current.connect(audioContextRef.current.destination);
    gainNodeRef.current.gain.value = volume;

    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  useEffect(() => {
    // Load new soundscape with crossfade
    if (soundscapeUrl) {
      loadAndPlaySoundscape(soundscapeUrl);
    }
  }, [soundscapeUrl]);

  async function loadAndPlaySoundscape(url: string) {
    if (!audioContextRef.current || !gainNodeRef.current) return;

    try {
      // Fetch and decode audio
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await audioContextRef.current.decodeAudioData(
        arrayBuffer
      );

      audioBufferRef.current = audioBuffer;

      // Crossfade if already playing
      if (currentSourceRef.current && isPlaying) {
        await crossfadeToNewSource(audioBuffer);
      } else {
        playSource(audioBuffer);
      }
    } catch (error) {
      console.error("Error loading soundscape:", error);
    }
  }

  function playSource(audioBuffer: AudioBuffer) {
    if (!audioContextRef.current || !gainNodeRef.current) return;

    const source = audioContextRef.current.createBufferSource();
    source.buffer = audioBuffer;
    source.loop = true;
    source.connect(gainNodeRef.current);
    source.start();

    currentSourceRef.current = source;
    setIsPlaying(true);
  }

  async function crossfadeToNewSource(newAudioBuffer: AudioBuffer) {
    if (!audioContextRef.current || !gainNodeRef.current) return;

    const oldGain = gainNodeRef.current;
    const newGain = audioContextRef.current.createGain();
    newGain.connect(audioContextRef.current.destination);
    newGain.gain.value = 0;

    // Start new source
    const newSource = audioContextRef.current.createBufferSource();
    newSource.buffer = newAudioBuffer;
    newSource.loop = true;
    newSource.connect(newGain);
    newSource.start();

    // Crossfade
    const now = audioContextRef.current.currentTime;
    oldGain.gain.linearRampToValueAtTime(0, now + crossfadeDuration);
    newGain.gain.linearRampToValueAtTime(volume, now + crossfadeDuration);

    // Clean up old source after fade
    setTimeout(() => {
      if (currentSourceRef.current) {
        currentSourceRef.current.stop();
        currentSourceRef.current.disconnect();
      }
    }, crossfadeDuration * 1000);

    currentSourceRef.current = newSource;
    gainNodeRef.current = newGain;
  }

  function togglePlayPause() {
    if (!audioBufferRef.current) return;

    if (isPlaying) {
      currentSourceRef.current?.stop();
      setIsPlaying(false);
    } else {
      playSource(audioBufferRef.current);
    }
  }

  return (
    <div className="audio-player">
      <button
        onClick={togglePlayPause}
        className="px-4 py-2 bg-blue-500 text-white rounded"
      >
        {isPlaying ? "Pause" : "Play"} Soundscape
      </button>
    </div>
  );
}
```

---

## 8. Cost Optimization Strategies

### Caching System
```typescript
// lib/soundscapeCache.ts
import { db } from "./db";
import { SceneAnalysis } from "./analyzeContent";

export async function findCachedSoundscape(
  analysis: SceneAnalysis
): Promise<string | null> {
  // Create a hash of the key scene attributes
  const cacheKey = `${analysis.setting}-${analysis.mood}-${analysis.intensity}`;

  const cached = await db.soundscape.findFirst({
    where: {
      generationPrompt: {
        contains: analysis.setting,
      },
      scene: {
        mood: analysis.mood,
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return cached?.audioUrl || null;
}
```

### Batch Processing
```typescript
// Process multiple books during off-peak hours
export async function batchProcessBooks(bookIds: string[]) {
  for (const bookId of bookIds) {
    await generateBookSoundscapes(bookId);
    // Add delay to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
}
```

---

## 9. Testing

### Example Test for Soundscape Generation
```typescript
// __tests__/soundscape.test.ts
import { generateSoundscape } from "@/lib/generateSoundscape";

describe("Soundscape Generation", () => {
  it("should generate forest ambience soundscape", async () => {
    const analysis = {
      setting: "forest",
      mood: "peaceful",
      intensity: "low" as const,
      actions: ["birds chirping", "wind rustling leaves"],
      audioPrompt:
        "Peaceful forest ambience with gentle bird songs and soft wind through trees",
    };

    const result = await generateSoundscape(analysis, "test-scene-1");

    expect(result.audioUrl).toBeTruthy();
    expect(result.duration).toBe(30);
  }, 60000); // 60 second timeout
});
```

---

## 10. Monitoring & Logging

```typescript
// lib/monitoring.ts
export function logSoundscapeGeneration(data: {
  sceneId: string;
  prompt: string;
  duration: number;
  cost: number;
}) {
  console.log(`[Soundscape Generated]`, {
    sceneId: data.sceneId,
    prompt: data.prompt,
    duration: `${data.duration}s`,
    cost: `$${data.cost.toFixed(4)}`,
    timestamp: new Date().toISOString(),
  });

  // Send to monitoring service (e.g., Sentry, DataDog)
  // monitoring.track('soundscape.generated', data);
}
```

---

## Next Steps

1. Set up Replicate account and get API token
2. Implement PDF text extraction with pdf.js
3. Build content analysis pipeline with Claude
4. Test soundscape generation with sample pages
5. Implement caching strategy
6. Set up background job processing
7. Build reading interface with audio player
8. Deploy to Fly.io with PostgreSQL

## Resources

- Replicate Docs: https://replicate.com/docs
- ElevenLabs Music: https://replicate.com/elevenlabs/music
- Web Audio API: https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API
- Next.js API Routes: https://nextjs.org/docs/app/building-your-application/routing/route-handlers
