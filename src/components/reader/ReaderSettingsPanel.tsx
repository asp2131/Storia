import { Mic, Music, Pause, Play, Volume1, Volume2, X } from "lucide-react";
import type { SoundscapeMode } from "@/hooks/useLocalPreferences";

type ReaderSettingsPanelProps = {
  open: boolean;
  narrationUrl: string | null | undefined;
  soundscapeUrl: string | null | undefined;
  isNarrationPlaying: boolean;
  isSoundscapePlaying: boolean;
  narrationVolume: number;
  soundscapeVolume: number;
  soundscapeMode: SoundscapeMode;
  onClose: () => void;
  onToggleNarration: () => void;
  onToggleSoundscape: () => void;
  onNarrationVolumeChange: (volume: number) => void;
  onSoundscapeVolumeChange: (volume: number) => void;
  onChangeSoundscapeMode: (mode: SoundscapeMode) => void;
};

export default function ReaderSettingsPanel({
  open,
  narrationUrl,
  soundscapeUrl,
  isNarrationPlaying,
  isSoundscapePlaying,
  narrationVolume,
  soundscapeVolume,
  soundscapeMode,
  onClose,
  onToggleNarration,
  onToggleSoundscape,
  onNarrationVolumeChange,
  onSoundscapeVolumeChange,
  onChangeSoundscapeMode,
}: ReaderSettingsPanelProps) {
  return (
    <div
      className="fixed inset-0 z-[70] transition-opacity duration-200"
      style={{
        opacity: open ? 1 : 0,
        pointerEvents: open ? "auto" : "none",
        visibility: open ? "visible" : "hidden",
      }}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className="absolute right-0 top-0 bottom-0 w-full max-w-sm bg-slate-900/95 backdrop-blur-md border-l border-white/10 shadow-2xl flex flex-col transition-transform duration-300"
        style={{ transform: open ? "translateX(0)" : "translateX(100%)" }}
      >
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white">Settings</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center">
                <Mic className="w-5 h-5 text-orange-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Narration</h3>
                <p className="text-xs text-slate-400">Voice reading</p>
              </div>
            </div>
            {narrationUrl ? (
              <div className="space-y-3 pl-[52px]">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-300">Playback</span>
                  <button
                    onClick={onToggleNarration}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${
                      isNarrationPlaying
                        ? "bg-orange-500 text-white"
                        : "bg-white/10 text-slate-300"
                    }`}
                  >
                    {isNarrationPlaying ? (
                      <>
                        <Pause className="w-4 h-4" />
                        Playing
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4" />
                        Play
                      </>
                    )}
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <Volume1 className="w-4 h-4 text-slate-400" />
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={Math.round(narrationVolume * 100)}
                    onChange={(e) =>
                      onNarrationVolumeChange(Number(e.target.value) / 100)
                    }
                    className="flex-1 h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-orange-500"
                  />
                  <Volume2 className="w-4 h-4 text-slate-400" />
                </div>
              </div>
            ) : (
              <p className="pl-[52px] text-sm text-slate-500 italic">
                No narration for this page
              </p>
            )}
          </div>

          <div className="border-t border-white/10" />

          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-teal-500/20 flex items-center justify-center">
                <Music className="w-5 h-5 text-teal-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Soundscape</h3>
                <p className="text-xs text-slate-400">Ambient audio</p>
              </div>
            </div>
            {soundscapeUrl ? (
              <div className="space-y-3 pl-[52px]">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-300">Playback</span>
                  <button
                    onClick={onToggleSoundscape}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${
                      isSoundscapePlaying
                        ? "bg-teal-500 text-white"
                        : "bg-white/10 text-slate-300"
                    }`}
                  >
                    {isSoundscapePlaying ? (
                      <>
                        <Pause className="w-4 h-4" />
                        Playing
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4" />
                        Play
                      </>
                    )}
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <Volume1 className="w-4 h-4 text-slate-400" />
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={Math.round(soundscapeVolume * 100)}
                    onChange={(e) =>
                      onSoundscapeVolumeChange(Number(e.target.value) / 100)
                    }
                    className="flex-1 h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-teal-500"
                  />
                  <Volume2 className="w-4 h-4 text-slate-400" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-300">Mode</span>
                  <div className="flex items-center bg-white/10 rounded-full p-1 gap-1">
                    <button
                      onClick={() => onChangeSoundscapeMode("intro-only")}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium ${
                        soundscapeMode === "intro-only"
                          ? "bg-teal-500 text-white"
                          : "text-slate-400"
                      }`}
                    >
                      One-shot
                    </button>
                    <button
                      onClick={() => onChangeSoundscapeMode("continuous")}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium ${
                        soundscapeMode === "continuous"
                          ? "bg-teal-500 text-white"
                          : "text-slate-400"
                      }`}
                    >
                      Loop
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <p className="pl-[52px] text-sm text-slate-500 italic">
                No soundscape for this page
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
