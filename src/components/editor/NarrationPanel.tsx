"use client";

// TODO: BookEditorContext.tsx already exists at src/contexts/BookEditorContext.tsx.
// useNarrationContext is exported from that file. The NarrationContext type
// in the live context uses `activeView: ActivePageView` (not `activePage`) and
// `generateSelectedTextNarration` (not `generateNarrationForSelection`).
// The narration-assignment delete is handled here via a prop sourced from
// audioLibrary.handleDeleteAudio — once the provider exposes deleteNarration
// directly on NarrationContext this import can be updated without touching JSX.

import {
  Headphones,
  Pause,
  Play,
  Loader2,
  Wand2,
  Sparkles,
  PlayCircle,
} from "lucide-react";
import { useNarrationContext, useOverlayTextContext } from "@/contexts/BookEditorContext";
import { OverlayTextPanel } from "@/components/editor/OverlayTextPanel";

/**
 * NarrationPanel — the Voice Narration section of the editor right rail.
 *
 * Renders:
 *  - Narration assignment status display + Remove button
 *  - Playback controls (play/pause + volume slider)
 *  - AI Generate section:
 *    - Multi-voice info banner (when overlay voices are active)
 *    - Voice selector dropdown
 *    - Voice settings sliders (speed, style exaggeration, speaker boost toggle)
 *    - "This Page" and "Selected text" generate buttons
 *  - Sync Preview section (word-highlight preview with play/pause)
 *
 * Does NOT include: page management, soundscape/ambient audio, overlay canvas,
 * book metadata, or the sound library.
 */
export function NarrationPanel({
  onDeleteNarration,
}: {
  /**
   * Callback to delete the narration assignment for the active page.
   * Provided externally because NarrationContext does not yet expose a
   * deleteNarration method — it is sourced from audioLibrary.handleDeleteAudio.
   * When the context is updated to include deleteNarration this prop can be
   * removed and the call wired directly.
   */
  onDeleteNarration: () => void;
}) {
  const {
    activeView,
    voiceOptions,
    selectedVoiceId,
    setSelectedVoiceId,
    voicesLoading,
    voiceSettings,
    setVoiceSettings,
    generating: generatingNarration,
    generatingPhase: overlayNarrationPhase,
    generateNarration: handleGenerateNarration,
    generateSelectedTextNarration: handleGenerateSelectedTextNarration,
    selectedOverlayElement,
    isNarrationPlaying,
    narrationVolume,
    setNarrationVolume,
    toggleNarration,
    wordTimestamps,
    activeWordIndex,
    showSyncPreview,
    setShowSyncPreview,
  } = useNarrationContext();
  const { hasIncludedEntries } = useOverlayTextContext();

  const activePageData = activeView.data;
  const narrationActiveUrl = activeView.narrationUrl;
  const activePageUsesOverlayVoices = activeView.usesOverlayVoices;
  const narrationAssignment = activeView.assignments.narration;

  return (
    /* ── Voice Narration ──────────────────────────────────── */
    <div className="space-y-3">
      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
        <Headphones className="w-3.5 h-3.5 text-amber-500" />
        Voice Narration
      </h4>

      <div className="bg-linear-to-br from-orange-50 to-yellow-50 rounded-xl p-4 border border-orange-200 shadow-sm space-y-4">
        {(narrationAssignment?.audioUrl || narrationActiveUrl) ? (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-xs font-semibold text-green-700">Assigned</span>
              </div>
              <button
                type="button"
                onClick={onDeleteNarration}
                className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded transition-colors disabled:opacity-50"
              >
                Remove
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-slate-300" />
            <span className="text-xs text-slate-500">No narration for this page</span>
          </div>
        )}

        {narrationActiveUrl && (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggleNarration}
              className="w-8 h-8 flex items-center justify-center bg-orange-600 text-white rounded-full hover:bg-orange-700 shadow-sm"
            >
              {isNarrationPlaying ? (
                <Pause className="w-3.5 h-3.5" />
              ) : (
                <Play className="w-3.5 h-3.5 ml-0.5" />
              )}
            </button>
            <input
              type="range"
              min="0"
              max="100"
              value={Math.round(narrationVolume * 100)}
              onChange={(e) => setNarrationVolume(Number(e.target.value) / 100)}
              className="flex-1 h-1 bg-orange-200 rounded-lg appearance-none cursor-pointer accent-orange-600"
            />
          </div>
        )}

        {/* AI Generate */}
        <div className="border-t border-orange-200/60 pt-3 space-y-3">
          <span className="text-xs font-semibold text-orange-700 flex items-center gap-1.5">
            <Wand2 className="w-3.5 h-3.5" />
            Generate with AI
          </span>
          {activePageUsesOverlayVoices ? (
            <div className="rounded-md border border-orange-200 bg-orange-100/60 px-2.5 py-2 text-[11px] text-orange-800">
              Multi-voice mode is active for this page. Voices are taken from each overlay text block.
            </div>
          ) : (
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-orange-700/90 uppercase tracking-wide">
                Voice
              </label>
              <select
                value={selectedVoiceId}
                onChange={(e) => setSelectedVoiceId(e.target.value)}
                disabled={voicesLoading || voiceOptions.length === 0}
                className="w-full rounded-md border border-orange-200 bg-white px-2 py-1.5 text-xs text-slate-700 disabled:opacity-60"
              >
                {voiceOptions.length === 0 ? (
                  <option value="">{voicesLoading ? "Loading voices..." : "Default voice"}</option>
                ) : (
                  voiceOptions.map((voice) => (
                    <option key={voice.id} value={voice.id}>
                      {voice.name}{voice.category ? ` (${voice.category})` : ""}
                    </option>
                  ))
                )}
              </select>
            </div>
          )}
          <div className="space-y-2 rounded-md border border-orange-200/80 bg-white/70 p-2.5">
            <div className="text-[10px] font-semibold text-orange-700/90 uppercase tracking-wide">
              Voice settings
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px] text-slate-600">
                <span>Speed</span>
                <span>{voiceSettings.speed.toFixed(2)}x</span>
              </div>
              <input
                type="range"
                min="0.7"
                max="1.2"
                step="0.01"
                value={voiceSettings.speed}
                onChange={(e) =>
                  setVoiceSettings((prev) => ({
                    ...prev,
                    speed: Number(e.target.value),
                  }))
                }
                className="w-full h-1.5 bg-orange-200 rounded-lg appearance-none cursor-pointer accent-orange-600"
              />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px] text-slate-600">
                <span>Style exaggeration</span>
                <span>{voiceSettings.style.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={voiceSettings.style}
                onChange={(e) =>
                  setVoiceSettings((prev) => ({
                    ...prev,
                    style: Number(e.target.value),
                  }))
                }
                className="w-full h-1.5 bg-orange-200 rounded-lg appearance-none cursor-pointer accent-orange-600"
              />
            </div>

            <label className="flex items-center justify-between text-[11px] text-slate-700">
              <span>Speaker boost</span>
              <button
                type="button"
                onClick={() =>
                  setVoiceSettings((prev) => ({
                    ...prev,
                    useSpeakerBoost: !prev.useSpeakerBoost,
                  }))
                }
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                  voiceSettings.useSpeakerBoost ? "bg-orange-500" : "bg-slate-300"
                }`}
                aria-pressed={voiceSettings.useSpeakerBoost}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    voiceSettings.useSpeakerBoost ? "translate-x-4" : "translate-x-0.5"
                  }`}
                />
              </button>
            </label>
          </div>

          <OverlayTextPanel />

          {!activePageData?.text?.trim() && !hasIncludedEntries && (
            <p className="text-[10px] text-orange-600/70 italic">
              Add page text or include overlay text first to generate narration.
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => handleGenerateNarration()}
              disabled={generatingNarration || (!activePageData?.text?.trim() && !hasIncludedEntries)}
              className="flex-1 flex items-center justify-center gap-2 rounded-md bg-linear-to-r from-orange-500 to-amber-500 text-white text-xs font-semibold py-2.5 hover:from-orange-600 hover:to-amber-600 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              {generatingNarration ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  {overlayNarrationPhase === "stitching"
                    ? "Stitching audio..."
                    : overlayNarrationPhase === "saving"
                    ? "Saving..."
                    : "Generating voices..."}
                </>
              ) : (
                <>
                  <Wand2 className="w-3.5 h-3.5" />
                  This Page
                </>
              )}
            </button>
            <button
              type="button"
              onClick={handleGenerateSelectedTextNarration}
              disabled={
                generatingNarration ||
                !selectedOverlayElement?.id ||
                !selectedOverlayElement.text?.trim()
              }
              className="flex items-center justify-center gap-2 rounded-md bg-linear-to-r from-purple-500 to-indigo-500 text-white text-xs font-semibold py-2.5 px-3 hover:from-purple-600 hover:to-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              <Sparkles className="w-3.5 h-3.5" />Selected text
            </button>
          </div>
          {!selectedOverlayElement?.id && (
            <p className="text-[10px] text-orange-600/70 italic">
              Select a text instance in the overlay editor to enable &quot;Selected text&quot;.
            </p>
          )}
        </div>

        {/* Sync preview */}
        {wordTimestamps.length > 0 && (
          <div className="border-t border-orange-200/60 pt-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-orange-700 flex items-center gap-1.5">
                <PlayCircle className="w-3.5 h-3.5" /> Sync Preview
              </span>
              <button
                type="button"
                onClick={() => setShowSyncPreview(!showSyncPreview)}
                className="text-[10px] text-orange-600 hover:text-orange-700 bg-orange-50 px-2 py-1 rounded-full border border-orange-200"
              >
                {showSyncPreview ? "Hide" : "Show"}
              </button>
            </div>
            {showSyncPreview && (
              <div className="bg-white/70 rounded-lg p-3 border border-orange-200/50">
                <div className="flex items-center gap-2 mb-3">
                  <button
                    type="button"
                    onClick={toggleNarration}
                    className="w-7 h-7 flex items-center justify-center bg-orange-600 text-white rounded-full"
                  >
                    {isNarrationPlaying ? (
                      <Pause className="w-3 h-3" />
                    ) : (
                      <Play className="w-3 h-3 ml-0.5" />
                    )}
                  </button>
                  <span className="text-[10px] text-slate-500">
                    {isNarrationPlaying ? "Playing..." : "Click to preview"}
                  </span>
                </div>
                <div className="max-h-32 overflow-y-auto">
                  <p className="text-sm leading-relaxed text-slate-700 font-serif">
                    {wordTimestamps.map((wd, i) => (
                      <span
                        key={i}
                        className={`transition-all duration-150 ${
                          i === activeWordIndex && isNarrationPlaying
                            ? "bg-orange-300 text-orange-900 rounded px-0.5 font-semibold"
                            : ""
                        }`}
                      >
                        {wd.word}{" "}
                      </span>
                    ))}
                  </p>
                </div>
                <div className="mt-2 text-[10px] text-slate-500">
                  {wordTimestamps.length} words synced
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
