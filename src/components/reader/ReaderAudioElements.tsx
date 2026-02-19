import type { RefObject } from "react";
import type { SoundscapeMode } from "@/hooks/useLocalPreferences";

type ReaderAudioElementsProps = {
  narrationRef: RefObject<HTMLAudioElement | null>;
  soundscapeRef: RefObject<HTMLAudioElement | null>;
  soundscapeMode: SoundscapeMode;
  onNarrationTimeUpdate: (currentTime: number) => void;
  onNarrationEnded: () => void;
  onSoundscapeEnded: () => void;
};

export default function ReaderAudioElements({
  narrationRef,
  soundscapeRef,
  soundscapeMode,
  onNarrationTimeUpdate,
  onNarrationEnded,
  onSoundscapeEnded,
}: ReaderAudioElementsProps) {
  return (
    <>
      <audio
        ref={narrationRef}
        crossOrigin="anonymous"
        onTimeUpdate={(e) => onNarrationTimeUpdate(e.currentTarget.currentTime)}
        onEnded={onNarrationEnded}
      />
      <audio
        ref={soundscapeRef}
        loop={soundscapeMode === "continuous"}
        crossOrigin="anonymous"
        onEnded={onSoundscapeEnded}
      />
    </>
  );
}
