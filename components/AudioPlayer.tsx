"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { getAudioPlayer } from "@/lib/audioPlayer";

interface Soundscape {
  id: string;
  audioUrl: string;
  duration: number;
  generationPrompt: string | null;
}

interface Scene {
  id: string;
  setting: string | null;
  mood: string | null;
  soundscapes: Soundscape[];
}

interface AudioPlayerProps {
  currentScene: Scene | null;
  onAudioError?: (error: Error) => void;
}

export default function AudioPlayer({
  currentScene,
  onAudioError,
}: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(70); // 0-100
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  const audioPlayerRef = useRef(getAudioPlayer());
  const currentSceneIdRef = useRef<string | null>(null);
  const currentBufferRef = useRef<AudioBuffer | null>(null);

  // Initialize audio player on mount
  useEffect(() => {
    const initializeAudio = async () => {
      try {
        await audioPlayerRef.current.initialize();
        setIsInitialized(true);
        // Set initial volume
        audioPlayerRef.current.setVolume(volume / 100);
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Failed to initialize audio");
        setError(error.message);
        onAudioError?.(error);
      }
    };

    initializeAudio();

    // Cleanup on unmount
    return () => {
      audioPlayerRef.current.dispose();
    };
  }, [onAudioError, volume]);

  // Load and play soundscape when scene changes
  useEffect(() => {
    const loadAndPlaySoundscape = async () => {
      // Skip if no scene or no soundscape available
      if (!currentScene || currentScene.soundscapes.length === 0) {
        return;
      }

      // Skip if same scene is already playing
      if (currentSceneIdRef.current === currentScene.id) {
        return;
      }

      // Skip if not initialized
      if (!isInitialized) {
        return;
      }

      const soundscape = currentScene.soundscapes[0];

      try {
        setIsLoading(true);
        setError(null);

        // Load audio buffer
        const buffer = await audioPlayerRef.current.loadAudio(soundscape.audioUrl);
        currentBufferRef.current = buffer;

        // If there's already audio playing, crossfade to new audio
        if (isPlaying && currentSceneIdRef.current) {
          audioPlayerRef.current.crossfadeTo(buffer, 3);
        } else if (isPlaying) {
          // If play button is active but no audio playing, start playing
          audioPlayerRef.current.play(buffer, true);
        }

        currentSceneIdRef.current = currentScene.id;
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Failed to load soundscape");
        setError(error.message);
        onAudioError?.(error);
        console.error("Failed to load soundscape:", err);
      } finally {
        setIsLoading(false);
      }
    };

    loadAndPlaySoundscape();
  }, [currentScene, isInitialized, isPlaying, onAudioError]);

  // Handle play/pause toggle
  const handlePlayPause = useCallback(async () => {
    if (!isInitialized) {
      return;
    }

    try {
      // Resume audio context if suspended (required by browsers)
      await audioPlayerRef.current.resumeContext();

      if (isPlaying) {
        // Pause
        audioPlayerRef.current.pause();
        setIsPlaying(false);
      } else {
        // Play
        if (currentBufferRef.current) {
          audioPlayerRef.current.play(currentBufferRef.current, true);
          setIsPlaying(true);
        } else if (currentScene && currentScene.soundscapes.length > 0) {
          // Load and play if buffer not available
          setIsLoading(true);
          const soundscape = currentScene.soundscapes[0];
          const buffer = await audioPlayerRef.current.loadAudio(soundscape.audioUrl);
          currentBufferRef.current = buffer;
          audioPlayerRef.current.play(buffer, true);
          setIsPlaying(true);
          setIsLoading(false);
        }
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Failed to play audio");
      setError(error.message);
      onAudioError?.(error);
      console.error("Failed to play/pause audio:", err);
    }
  }, [isPlaying, isInitialized, currentScene, onAudioError]);

  // Handle volume change
  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseInt(e.target.value, 10);
    setVolume(newVolume);
    audioPlayerRef.current.setVolume(newVolume / 100);
  }, []);

  // Get current soundscape info
  const currentSoundscape = currentScene?.soundscapes[0];

  return (
    <div className="bg-gray-800 rounded-lg p-4 shadow-lg">
      <div className="flex items-center gap-4">
        {/* Play/Pause Button */}
        <button
          onClick={handlePlayPause}
          disabled={!currentSoundscape || isLoading || !isInitialized}
          className="flex-shrink-0 w-12 h-12 rounded-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800"
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isLoading ? (
            <svg
              className="animate-spin h-6 w-6 text-white"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          ) : isPlaying ? (
            <svg
              className="w-6 h-6 text-white"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
            </svg>
          ) : (
            <svg
              className="w-6 h-6 text-white ml-1"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        {/* Soundscape Info */}
        <div className="flex-1 min-w-0">
          {currentSoundscape ? (
            <div>
              <div className="text-sm font-medium text-white truncate">
                {currentScene?.setting || "Unknown Setting"}
              </div>
              <div className="text-xs text-gray-400 truncate">
                {currentScene?.mood || "Unknown Mood"}
              </div>
            </div>
          ) : (
            <div className="text-sm text-gray-500">
              No soundscape available
            </div>
          )}
        </div>

        {/* Volume Control */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => {
              const newVolume = volume === 0 ? 70 : 0;
              setVolume(newVolume);
              audioPlayerRef.current.setVolume(newVolume / 100);
            }}
            className="text-gray-400 hover:text-white transition focus:outline-none"
            aria-label={volume === 0 ? "Unmute" : "Mute"}
          >
            {volume === 0 ? (
              <svg
                className="w-5 h-5"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
              </svg>
            ) : volume < 50 ? (
              <svg
                className="w-5 h-5"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M7 9v6h4l5 5V4l-5 5H7z" />
              </svg>
            ) : (
              <svg
                className="w-5 h-5"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
              </svg>
            )}
          </button>
          <input
            type="range"
            min="0"
            max="100"
            value={volume}
            onChange={handleVolumeChange}
            className="w-24 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
            aria-label="Volume"
          />
          <span className="text-xs text-gray-400 w-8 text-right">
            {volume}%
          </span>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mt-3 text-xs text-red-400 bg-red-900/20 rounded px-3 py-2">
          {error}
        </div>
      )}

      {/* Custom slider styles */}
      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
        }

        .slider::-moz-range-thumb {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
          border: none;
        }

        .slider::-webkit-slider-thumb:hover {
          background: #2563eb;
        }

        .slider::-moz-range-thumb:hover {
          background: #2563eb;
        }
      `}</style>
    </div>
  );
}
