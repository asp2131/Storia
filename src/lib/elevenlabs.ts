export type ElevenLabsVoice = {
  voice_id: string;
  name: string;
  category?: string;
};

type VoicesResponse = {
  voices?: ElevenLabsVoice[];
};

type CharacterAlignment = {
  characters?: string[];
  character_start_times_seconds?: number[];
  character_end_times_seconds?: number[];
};

type WithTimestampsResponse = {
  audio_base64?: string;
  alignment?: CharacterAlignment;
  normalized_alignment?: CharacterAlignment;
};

export type WordTimestamp = {
  word: string;
  start: number;
  end: number;
};

const ELEVENLABS_BASE_URL = "https://api.elevenlabs.io/v1";

/**
 * Extract the storage file path from a Supabase public URL.
 * e.g. "https://x.supabase.co/storage/v1/object/public/storia-storage/books/1/foo.mp3"
 *   → "books/1/foo.mp3"
 */
export function extractStoragePath(publicUrl: string, bucket: string): string | null {
  const marker = `/storage/v1/object/public/${bucket}/`;
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return null;
  return publicUrl.slice(idx + marker.length);
}

export function normalizeVoiceSettings(input: unknown) {
  const raw = (input || {}) as {
    speed?: unknown;
    style?: unknown;
    useSpeakerBoost?: unknown;
  };

  const speedNum = Number(raw.speed);
  const styleNum = Number(raw.style);

  return {
    speed:
      Number.isFinite(speedNum) && speedNum >= 0.7 && speedNum <= 1.2
        ? speedNum
        : 0.75,
    style:
      Number.isFinite(styleNum) && styleNum >= 0 && styleNum <= 1
        ? styleNum
        : 0.76,
    useSpeakerBoost:
      typeof raw.useSpeakerBoost === "boolean" ? raw.useSpeakerBoost : true,
  };
}

export function getElevenLabsApiKey() {
  return process.env.ELEVENLABS_API_KEY || "";
}

function ensureApiKey() {
  const apiKey = getElevenLabsApiKey();
  if (!apiKey) {
    throw new Error("Missing ELEVENLABS_API_KEY in environment.");
  }
  return apiKey;
}

export async function listElevenLabsVoices(): Promise<ElevenLabsVoice[]> {
  const apiKey = ensureApiKey();
  const response = await fetch(`${ELEVENLABS_BASE_URL}/voices`, {
    headers: {
      "xi-api-key": apiKey,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Failed to fetch ElevenLabs voices (${response.status}): ${text}`);
  }

  const data = (await response.json()) as VoicesResponse;
  return Array.isArray(data.voices) ? data.voices : [];
}

export async function resolveElevenLabsVoice(voiceHint?: string): Promise<{
  voiceId: string;
  voiceName?: string;
}> {
  const envDefaultVoiceId = process.env.ELEVENLABS_DEFAULT_VOICE_ID;
  if (voiceHint && /^[a-zA-Z0-9_-]{20,}$/.test(voiceHint)) {
    return { voiceId: voiceHint };
  }
  if (!voiceHint && envDefaultVoiceId) {
    return { voiceId: envDefaultVoiceId };
  }

  const voices = await listElevenLabsVoices();
  if (voices.length === 0) {
    throw new Error("No ElevenLabs voices available for this API key.");
  }

  const byName = voiceHint
    ? voices.find((v) => v.name.toLowerCase() === voiceHint.toLowerCase())
    : undefined;

  if (byName) {
    return { voiceId: byName.voice_id, voiceName: byName.name };
  }

  if (envDefaultVoiceId) {
    const byId = voices.find((v) => v.voice_id === envDefaultVoiceId);
    if (byId) {
      return { voiceId: byId.voice_id, voiceName: byId.name };
    }
  }

  const reginald = voices.find((v) => v.name.toLowerCase() === "reginald");
  if (reginald) {
    return { voiceId: reginald.voice_id, voiceName: reginald.name };
  }

  return { voiceId: voices[0].voice_id, voiceName: voices[0].name };
}

export async function synthesizeSpeech(params: {
  text: string;
  voiceId: string;
  speed?: number;
  style?: number;
  useSpeakerBoost?: boolean;
}): Promise<{ audioBuffer: Buffer; contentType: string }> {
  const apiKey = ensureApiKey();
  const response = await fetch(`${ELEVENLABS_BASE_URL}/text-to-speech/${params.voiceId}`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text: params.text,
      model_id: "eleven_turbo_v2_5",
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
        style: params.style ?? 0.76,
        speed: params.speed ?? 1,
        use_speaker_boost: params.useSpeakerBoost ?? true,
      },
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`ElevenLabs speech generation failed (${response.status}): ${text}`);
  }

  const audioBuffer = Buffer.from(await response.arrayBuffer());
  const contentType = response.headers.get("content-type") || "audio/mpeg";

  return { audioBuffer, contentType };
}

function alignmentToWordTimestamps(alignment?: CharacterAlignment): WordTimestamp[] {
  if (!alignment?.characters?.length) {
    return [];
  }

  const chars = alignment.characters;
  const starts = alignment.character_start_times_seconds || [];
  const ends = alignment.character_end_times_seconds || [];

  const result: WordTimestamp[] = [];
  let currentWord = "";
  let currentStart = -1;
  let currentEnd = -1;

  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i] || "";
    const start = typeof starts[i] === "number" ? starts[i] : currentEnd;
    const end = typeof ends[i] === "number" ? ends[i] : start;
    const isWhitespace = /\s/.test(ch);

    if (isWhitespace) {
      if (currentWord) {
        result.push({
          word: currentWord,
          start: currentStart >= 0 ? currentStart : 0,
          end: currentEnd >= 0 ? currentEnd : currentStart,
        });
        currentWord = "";
        currentStart = -1;
        currentEnd = -1;
      }
      continue;
    }

    if (!currentWord) {
      currentStart = start >= 0 ? start : 0;
      currentEnd = end >= 0 ? end : currentStart;
      currentWord = ch;
    } else {
      currentWord += ch;
      currentEnd = end >= 0 ? end : currentEnd;
    }
  }

  if (currentWord) {
    result.push({
      word: currentWord,
      start: currentStart >= 0 ? currentStart : 0,
      end: currentEnd >= 0 ? currentEnd : currentStart,
    });
  }

  return result;
}

export async function synthesizeSpeechWithTimestamps(params: {
  text: string;
  voiceId: string;
  speed?: number;
  style?: number;
  useSpeakerBoost?: boolean;
}): Promise<{ audioBuffer: Buffer; contentType: string; wordTimestamps: WordTimestamp[] }> {
  const apiKey = ensureApiKey();
  const response = await fetch(
    `${ELEVENLABS_BASE_URL}/text-to-speech/${params.voiceId}/with-timestamps`,
    {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        text: params.text,
        model_id: "eleven_turbo_v2_5",
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: params.style ?? 0.76,
          speed: params.speed ?? 1,
          use_speaker_boost: params.useSpeakerBoost ?? true,
        },
      }),
    }
  );

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `ElevenLabs speech+timestamps generation failed (${response.status}): ${text}`
    );
  }

  const payload = (await response.json()) as WithTimestampsResponse;
  if (!payload.audio_base64) {
    throw new Error("ElevenLabs did not return audio_base64.");
  }

  const audioBuffer = Buffer.from(payload.audio_base64, "base64");
  const alignment = payload.alignment || payload.normalized_alignment;
  const wordTimestamps = alignmentToWordTimestamps(alignment);

  return {
    audioBuffer,
    contentType: "audio/mpeg",
    wordTimestamps,
  };
}
