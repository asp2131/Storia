"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Mic, RotateCcw, Square, Upload } from "lucide-react";

const MAX_RECORDING_MS = 5 * 60 * 1000;
const MIME_TYPES = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm", "audio/ogg"];

type RecordingPreview = {
  blob: Blob;
  durationMs: number;
  url: string;
};

type RecorderState = "idle" | "requesting" | "recording" | "preview" | "saving";

function formatElapsed(milliseconds: number) {
  const seconds = Math.floor(milliseconds / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function fileExtension(contentType: string) {
  if (contentType.startsWith("audio/mp4")) return "m4a";
  if (contentType.startsWith("audio/ogg")) return "ogg";
  return "webm";
}

export function PageNarrationRecorder({
  pageNumber,
  disabledReason,
  onSave,
}: {
  pageNumber: number;
  disabledReason?: string;
  onSave: (file: File, durationMs: number) => Promise<void>;
}) {
  const [state, setState] = useState<RecorderState>("idle");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [preview, setPreview] = useState<RecordingPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const previewUrlRef = useRef<string | null>(null);
  const disposedRef = useRef(false);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const discardPreview = useCallback(() => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = null;
    setPreview(null);
  }, []);

  const stopRecording = useCallback(() => {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    stopStream();
  }, [stopStream]);

  const startRecording = useCallback(async () => {
    discardPreview();
    setError(null);
    setElapsedMs(0);

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("Microphone recording is not supported in this browser.");
      return;
    }

    setState("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (disposedRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      const mimeType = MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      chunksRef.current = [];
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        stopStream();
        setError("The recording stopped unexpectedly. Please try again.");
        setState("idle");
      };
      recorder.onstop = () => {
        stopStream();
        if (disposedRef.current) return;

        const durationMs = Math.min(
          MAX_RECORDING_MS,
          Math.max(1, Date.now() - startedAtRef.current)
        );
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || chunksRef.current[0]?.type || "audio/webm",
        });
        if (blob.size === 0) {
          setError("No audio was captured. Please try again.");
          setState("idle");
          return;
        }

        const url = URL.createObjectURL(blob);
        previewUrlRef.current = url;
        setElapsedMs(durationMs);
        setPreview({ blob, durationMs, url });
        setState("preview");
      };

      startedAtRef.current = Date.now();
      recorder.start(250);
      setState("recording");
    } catch (cause) {
      stopStream();
      if (disposedRef.current) return;
      setState("idle");
      setError(
        cause instanceof DOMException && cause.name === "NotAllowedError"
          ? "Microphone access was denied. Allow it in your browser settings and try again."
          : "Could not start the microphone. Please try again."
      );
    }
  }, [discardPreview, stopStream]);

  const saveRecording = useCallback(async () => {
    if (!preview) return;
    setError(null);
    setState("saving");
    try {
      const file = new File(
        [preview.blob],
        `page-${pageNumber}.${fileExtension(preview.blob.type)}`,
        { type: preview.blob.type }
      );
      await onSave(file, preview.durationMs);
      discardPreview();
      setState("idle");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to save the recording.");
      setState("preview");
    }
  }, [discardPreview, onSave, pageNumber, preview]);

  useEffect(() => {
    if (state !== "recording") return;
    const timer = window.setInterval(() => {
      const next = Date.now() - startedAtRef.current;
      setElapsedMs(next);
      if (next >= MAX_RECORDING_MS) stopRecording();
    }, 250);
    return () => window.clearInterval(timer);
  }, [state, stopRecording]);

  useEffect(() => {
    return () => {
      disposedRef.current = true;
      if (recorderRef.current?.state === "recording") {
        recorderRef.current.onstop = null;
        recorderRef.current.stop();
      }
      stopStream();
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, [stopStream]);

  return (
    <div className="space-y-3 border-t border-zinc-100 pt-3">
      <span className="flex items-center gap-1.5 text-xs font-semibold text-rose-600">
        <Mic className="h-3.5 w-3.5" />
        Record your voice
      </span>

      <div className="rounded-[9px] border border-rose-100 bg-rose-50/60 p-3">
        {state === "idle" && (
          <button
            type="button"
            onClick={() => void startRecording()}
            disabled={Boolean(disabledReason)}
            className="flex w-full items-center justify-center gap-2 rounded-[9px] bg-rose-600 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Mic className="h-4 w-4" />
            Record page {pageNumber}
          </button>
        )}

        {state === "requesting" && (
          <div className="flex items-center justify-center gap-2 py-2 text-xs font-medium text-rose-700">
            <Loader2 className="h-4 w-4 animate-spin" />
            Waiting for microphone…
          </div>
        )}

        {state === "recording" && (
          <button
            type="button"
            onClick={stopRecording}
            className="flex w-full items-center justify-center gap-2 rounded-[9px] bg-zinc-900 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-zinc-800"
            aria-label={`Stop recording page ${pageNumber}`}
          >
            <span className="h-2 w-2 animate-pulse rounded-full bg-rose-500" />
            {formatElapsed(elapsedMs)}
            <Square className="h-3.5 w-3.5 fill-current" />
            Stop
          </button>
        )}

        {(state === "preview" || state === "saving") && preview && (
          <div className="space-y-2.5">
            <audio className="h-8 w-full" controls preload="metadata" src={preview.url} />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void startRecording()}
                disabled={state === "saving"}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-[8px] border border-rose-200 bg-white py-2 text-[11px] font-semibold text-rose-700 disabled:opacity-50"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Retake
              </button>
              <button
                type="button"
                onClick={() => void saveRecording()}
                disabled={state === "saving"}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-[8px] bg-rose-600 py-2 text-[11px] font-semibold text-white disabled:opacity-60"
              >
                {state === "saving" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Upload className="h-3.5 w-3.5" />
                )}
                {state === "saving" ? "Saving…" : "Use recording"}
              </button>
            </div>
          </div>
        )}

        {disabledReason && state === "idle" && (
          <p className="mt-2 text-center text-[10px] text-zinc-500">{disabledReason}</p>
        )}
        {error && (
          <p className="mt-2 text-[10px] font-medium text-rose-700" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
