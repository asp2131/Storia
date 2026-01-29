import { useState, useEffect, useCallback } from 'react';

export type SoundscapeMode = 'continuous' | 'intro-only';

export interface ReaderPreferences {
  soundscapeMode: SoundscapeMode;
  soundscapeEnabled: boolean;
  hasSeenNavigationHint: boolean;
}

const STORAGE_KEY = 'storia-reader-preferences';

const defaultPreferences: ReaderPreferences = {
  soundscapeMode: 'continuous',
  soundscapeEnabled: true,
  hasSeenNavigationHint: false,
};

export function useLocalPreferences() {
  const [preferences, setPreferences] = useState<ReaderPreferences>(defaultPreferences);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load preferences from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setPreferences({ ...defaultPreferences, ...parsed });
      }
    } catch (e) {
      console.warn('Failed to load preferences:', e);
    }
    setIsLoaded(true);
  }, []);

  // Save preferences to localStorage
  const savePreferences = useCallback((updates: Partial<ReaderPreferences>) => {
    setPreferences((prev) => {
      const next = { ...prev, ...updates };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch (e) {
        console.warn('Failed to save preferences:', e);
      }
      return next;
    });
  }, []);

  const setSoundscapeMode = useCallback((mode: SoundscapeMode) => {
    savePreferences({ soundscapeMode: mode });
  }, [savePreferences]);

  const setSoundscapeEnabled = useCallback((enabled: boolean) => {
    savePreferences({ soundscapeEnabled: enabled });
  }, [savePreferences]);

  const setHasSeenNavigationHint = useCallback((seen: boolean) => {
    savePreferences({ hasSeenNavigationHint: seen });
  }, [savePreferences]);

  return {
    preferences,
    isLoaded,
    setSoundscapeMode,
    setSoundscapeEnabled,
    setHasSeenNavigationHint,
  };
}
