import { useRef, useCallback, useEffect } from 'react';

interface CrossFadeOptions {
  fadeInDuration?: number;
  fadeOutDuration?: number;
  volume?: number;
}

interface AudioCrossFadeReturn {
  initAudioContext: () => AudioContext | null;
  connectAudioElement: (audioElement: HTMLAudioElement) => GainNode | null;
  fadeIn: (duration?: number, targetVolume?: number) => void;
  fadeOut: (duration?: number) => void;
  setVolume: (volume: number) => void;
  cleanup: () => void;
}

export function useAudioCrossFade(): AudioCrossFadeReturn {
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const connectedElementRef = useRef<HTMLAudioElement | null>(null);

  // Initialize AudioContext (must be called after user interaction on iOS)
  const initAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      try {
        audioContextRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      } catch (e) {
        console.warn('Failed to create AudioContext:', e);
        return null;
      }
    }

    // Resume if suspended (iOS requirement)
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }

    return audioContextRef.current;
  }, []);

  // Connect an audio element to Web Audio API for gain control
  const connectAudioElement = useCallback((audioElement: HTMLAudioElement) => {
    const ctx = initAudioContext();
    if (!ctx) return null;

    // If already connected to this element, just return the gain node
    if (connectedElementRef.current === audioElement && gainNodeRef.current) {
      return gainNodeRef.current;
    }

    // Disconnect previous if exists
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.disconnect();
      } catch {
        // Ignore disconnect errors
      }
    }

    try {
      // Create new nodes
      const source = ctx.createMediaElementSource(audioElement);
      const gainNode = ctx.createGain();

      source.connect(gainNode);
      gainNode.connect(ctx.destination);

      sourceNodeRef.current = source;
      gainNodeRef.current = gainNode;
      connectedElementRef.current = audioElement;

      return gainNode;
    } catch (e) {
      console.warn('Failed to connect audio element:', e);
      return null;
    }
  }, [initAudioContext]);

  // Fade in the audio
  const fadeIn = useCallback((duration: number = 1.5, targetVolume: number = 0.6) => {
    const ctx = audioContextRef.current;
    const gainNode = gainNodeRef.current;
    if (!ctx || !gainNode) return;

    const now = ctx.currentTime;
    gainNode.gain.cancelScheduledValues(now);
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(targetVolume, now + duration);
  }, []);

  // Fade out the audio
  const fadeOut = useCallback((duration: number = 3) => {
    const ctx = audioContextRef.current;
    const gainNode = gainNodeRef.current;
    if (!ctx || !gainNode) return;

    const now = ctx.currentTime;
    gainNode.gain.cancelScheduledValues(now);
    gainNode.gain.setValueAtTime(gainNode.gain.value, now);
    gainNode.gain.linearRampToValueAtTime(0, now + duration);
  }, []);

  // Set volume immediately
  const setVolume = useCallback((volume: number) => {
    const ctx = audioContextRef.current;
    const gainNode = gainNodeRef.current;
    if (!ctx || !gainNode) return;

    const now = ctx.currentTime;
    gainNode.gain.cancelScheduledValues(now);
    gainNode.gain.setValueAtTime(volume, now);
  }, []);

  // Cleanup
  const cleanup = useCallback(() => {
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.disconnect();
      } catch {
        // Ignore
      }
    }
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch {
        // Ignore
      }
    }
    sourceNodeRef.current = null;
    gainNodeRef.current = null;
    audioContextRef.current = null;
    connectedElementRef.current = null;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    initAudioContext,
    connectAudioElement,
    fadeIn,
    fadeOut,
    setVolume,
    cleanup,
  };
}
