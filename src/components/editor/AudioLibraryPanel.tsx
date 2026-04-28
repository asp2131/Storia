"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  Headphones,
  Pause,
  Play,
  Loader2,
  Wand2,
  Sparkles,
  Music,
  Upload,
  FolderOpen,
  ChevronDown,
  ChevronRight,
  GripHorizontal,
  FileAudio,
  PlayCircle,
  Mic,
  Volume2,
  BookOpen,
} from "lucide-react";
import {
  useNarrationContext,
  useAudioLibraryContext,
  usePageManagerContext,
} from "@/contexts/BookEditorContext";
import { PronunciationPanel } from "@/components/editor/PronunciationPanel";
import { NarrationPanel } from "@/components/editor/NarrationPanel";

export function AudioLibraryPanel() {
  const params = useParams();
  const bookId = params.id as string;
  const narration = useNarrationContext();
  const audioLibrary = useAudioLibraryContext();
  const { localPages } = usePageManagerContext();

  const {
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
    activeView,
  } = narration;

  const {
    libraryLoading,
    libraryOpen,
    setLibraryOpen,
    selectedCategory,
    setSelectedCategory,
    librarySearch,
    setLibrarySearch,
    filteredLibrarySounds,
    libraryPreviewUrl,
    toggleLibraryPreview,
    handleDragStart,
    handleDragEnd,
    dropAssignment,
    setDropAssignment,
    dropRangeStart,
    setDropRangeStart,
    dropRangeEnd,
    setDropRangeEnd,
    dropScope,
    setDropScope,
    confirmDropAssignment,
    assignAudioPending,
    soundscapeUrlInput,
    setSoundscapeUrlInput,
    soundscapeScope,
    setSoundscapeScope,
    soundscapeRangeStart,
    setSoundscapeRangeStart,
    soundscapeRangeEnd,
    setSoundscapeRangeEnd,
    isSoundscapePlaying,
    soundscapeVolume,
    setSoundscapeVolume,
    toggleSoundscape,
    handleAssignAudio,
    handleDeleteAudio,
    uploadAudioPending,
    audioUploadDragging,
    setAudioUploadDragging,
    handleAudioDropZone,
    audioInputRef,
  } = audioLibrary;

  // Derive convenience values (same as page.tsx lines 157–187)
  const activePageData = activeView.data;
  const narrationActiveUrl = activeView.narrationUrl;
  const soundscapeActiveUrl = activeView.soundscapeUrl;
  const activeAssignments = {
    narration: activeView.assignments.narration
      ? {
          url: activeView.assignments.narration.audioUrl,
          scope: activeView.assignments.narration.scope,
          range:
            activeView.assignments.narration.scope === "range" &&
            activeView.assignments.narration.rangeStart != null &&
            activeView.assignments.narration.rangeEnd != null
              ? `${activeView.assignments.narration.rangeStart}-${activeView.assignments.narration.rangeEnd}`
              : "current",
        }
      : undefined,
    soundscape: activeView.assignments.soundscape
      ? {
          url: activeView.assignments.soundscape.audioUrl,
          scope: activeView.assignments.soundscape.scope,
          range:
            activeView.assignments.soundscape.scope === "range" &&
            activeView.assignments.soundscape.rangeStart != null &&
            activeView.assignments.soundscape.rangeEnd != null
              ? `${activeView.assignments.soundscape.rangeStart}-${activeView.assignments.soundscape.rangeEnd}`
              : "current",
        }
      : undefined,
  };
  const activePageUsesOverlayVoices = activeView.usesOverlayVoices;
  const [narrationTarget, setNarrationTarget] = useState<"page" | "selected">("page");

  const selectedTextReady = Boolean(
    selectedOverlayElement?.id && selectedOverlayElement.text?.trim()
  );
  const hasNarrationResult = Boolean(activeAssignments?.narration?.url || narrationActiveUrl);
  const canGeneratePage = Boolean(activePageData?.text?.trim());
  const canGenerateForTarget = narrationTarget === "page" ? canGeneratePage : selectedTextReady;
  const currentStep = generatingNarration ? 3 : hasNarrationResult ? 4 : 1;

  const generationPhaseLabel = useMemo(() => {
    if (!generatingNarration) return hasNarrationResult ? "Done" : "Idle";

    switch (overlayNarrationPhase) {
      case "stitching":
        return "Stitching audio";
      case "saving":
        return "Saving assignment";
      case "generating":
        return "Generating voices";
      default:
        return "Generating audio";
    }
  }, [generatingNarration, hasNarrationResult, overlayNarrationPhase]);

  const generationStatusText = useMemo(() => {
    if (!generatingNarration) {
      return hasNarrationResult
        ? "Narration ready for review."
        : "Ready to generate narration.";
    }

    switch (overlayNarrationPhase) {
      case "stitching":
        return "Combining generated clips into one narration track.";
      case "saving":
        return "Attaching narration to the active page.";
      case "generating":
        return "Calling voice model and producing speech clips.";
      default:
        return "Preparing request and generating narration audio.";
    }
  }, [generatingNarration, hasNarrationResult, overlayNarrationPhase]);

  const handleRunNarrationFlow = () => {
    if (narrationTarget === "selected") {
      return handleGenerateSelectedTextNarration();
    }
    return handleGenerateNarration();
  };

  const [activeTab, setActiveTab] = useState<"narrate" | "sound" | "words">("narrate");

  return (
    <>
      {/* ─── RIGHT SIDEBAR: Tabbed Audio Panel ─────────────────── */}
      <aside className="w-80 bg-white border-l border-slate-200 flex flex-col shadow-[-4px_0_24px_-12px_rgba(0,0,0,0.05)] z-20 shrink-0">
        {/* Tab Header */}
        <div className="h-14 flex items-center px-2 border-b border-slate-100 bg-white/50 backdrop-blur-sm">
          <div className="flex w-full gap-1">
            {[
              { id: "narrate" as const, label: "Narrate", icon: Mic },
              { id: "sound" as const, label: "Sound", icon: Volume2 },
              { id: "words" as const, label: "Words", icon: BookOpen },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-semibold transition ${
                  activeTab === tab.id
                    ? "bg-slate-900 text-white shadow-sm"
                    : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                }`}
              >
                <tab.icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {activeTab === "narrate" && (
            <NarrationPanel onDeleteNarration={() => handleDeleteAudio("narration")} />
          )}

          {activeTab === "sound" && (
            <div className="space-y-5">
              {/* ── Ambient Soundscape ───────────────────────────────── */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Ambient Soundscape</h4>

                <div className="bg-linear-to-br from-amber-50 to-orange-50 rounded-xl p-4 border border-amber-100 shadow-sm space-y-4">
                  {activeAssignments?.soundscape ? (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        <span className="text-xs font-semibold text-green-700">Assigned</span>
                        {activeAssignments.soundscape.scope === "range" && (
                          <span className="text-[10px] text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded-full">
                            Pages {activeAssignments.soundscape.range}
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteAudio("soundscape")}
                        className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded"
                      >
                        Remove
                      </button>
                    </div>
                  ) : null}

                  {soundscapeActiveUrl && (
                    <div className="flex items-center gap-3">
                      <button type="button" onClick={toggleSoundscape} className="w-8 h-8 flex items-center justify-center bg-amber-500 text-white rounded-full hover:bg-amber-600 shadow-sm">
                        {isSoundscapePlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
                      </button>
                      <input
                        type="range" min="0" max="100"
                        value={Math.round(soundscapeVolume * 100)}
                        onChange={(e) => setSoundscapeVolume(Number(e.target.value) / 100)}
                        className="flex-1 h-1 bg-amber-200 rounded-lg appearance-none cursor-pointer accent-amber-500"
                      />
                    </div>
                  )}

                  {/* Upload Audio */}
                  <div className="border-t border-amber-100 pt-3 space-y-3">
                    <span className="text-xs font-semibold text-amber-700 flex items-center gap-1.5">
                      <Upload className="w-3.5 h-3.5" />
                      Upload Audio
                    </span>
                    <div
                      onDragOver={(e) => { e.preventDefault(); setAudioUploadDragging(true); }}
                      onDragLeave={() => setAudioUploadDragging(false)}
                      onDrop={handleAudioDropZone}
                      onClick={() => audioInputRef.current?.click()}
                      className={`rounded-lg border-2 border-dashed p-4 flex flex-col items-center gap-2 cursor-pointer transition-all ${
                        audioUploadDragging
                          ? "border-amber-400 bg-amber-50"
                          : "border-amber-200 hover:border-amber-400 hover:bg-amber-50/50"
                      }`}
                    >
                      {uploadAudioPending ? (
                        <>
                          <Loader2 className="w-5 h-5 text-amber-500 animate-spin" />
                          <span className="text-[10px] text-amber-600">Uploading...</span>
                        </>
                      ) : (
                        <>
                          <FileAudio className="w-5 h-5 text-amber-400" />
                          <span className="text-[10px] text-amber-600 text-center">
                            Drop audio file or click to browse
                          </span>
                          <span className="text-[9px] text-amber-400">MP3, WAV, OGG, FLAC &bull; Max 50MB</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* URL input */}
                  <div className="space-y-3 border-t border-amber-100 pt-3">
                    <span className="text-xs font-semibold text-amber-700">Or Paste URL</span>
                    <input
                      value={soundscapeUrlInput}
                      onChange={(e) => setSoundscapeUrlInput(e.target.value)}
                      placeholder="Paste soundscape URL"
                      className="w-full rounded-md border border-amber-200 bg-white/70 px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-300"
                    />
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => setSoundscapeScope("current")} className={`px-2.5 py-1 rounded text-[10px] font-semibold border ${soundscapeScope === "current" ? "bg-amber-500 text-white border-amber-500" : "bg-white text-amber-700 border-amber-200"}`}>
                        Current Page
                      </button>
                      <button type="button" onClick={() => setSoundscapeScope("range")} className={`px-2.5 py-1 rounded text-[10px] font-semibold border ${soundscapeScope === "range" ? "bg-amber-500 text-white border-amber-500" : "bg-white text-amber-700 border-amber-200"}`}>
                        Range
                      </button>
                      {soundscapeScope === "range" && (
                        <div className="flex items-center gap-2 text-[10px] text-amber-700">
                          <input type="number" min={1} max={localPages.length} value={soundscapeRangeStart} onChange={(e) => setSoundscapeRangeStart(Number(e.target.value))} className="w-14 rounded border border-amber-200 bg-white px-2 py-1 text-xs" />
                          <span>to</span>
                          <input type="number" min={soundscapeRangeStart} max={localPages.length} value={soundscapeRangeEnd} onChange={(e) => setSoundscapeRangeEnd(Number(e.target.value))} className="w-14 rounded border border-amber-200 bg-white px-2 py-1 text-xs" />
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAssignAudio("soundscape", soundscapeUrlInput, soundscapeScope, soundscapeRangeStart, soundscapeRangeEnd)}
                      className="w-full rounded-md bg-amber-500 text-white text-xs font-semibold py-2 hover:bg-amber-600"
                    >
                      Save Assignment
                    </button>
                  </div>
                </div>
              </div>

              {/* ── Sound Library ────────────────────────────────────── */}
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => setLibraryOpen(!libraryOpen)}
                  className="flex items-center justify-between w-full group"
                >
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <FolderOpen className="w-3.5 h-3.5" />
                    Sound Library
                  </h4>
                  {libraryOpen ? (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  )}
                </button>

                {libraryOpen && (
                  <div className="bg-linear-to-br from-slate-50 to-slate-100/50 rounded-xl p-4 border border-slate-200 shadow-sm space-y-3">
                    {/* Search */}
                    <input
                      value={librarySearch}
                      onChange={(e) => setLibrarySearch(e.target.value)}
                      placeholder="Search sounds..."
                      className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-300"
                    />

                    {libraryLoading ? (
                      <div className="flex items-center justify-center py-6">
                        <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                      </div>
                    ) : Object.keys(filteredLibrarySounds).length === 0 ? (
                      <div className="text-center py-6 text-xs text-slate-400">
                        {librarySearch ? "No sounds match your search" : "No sounds in library"}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {/* Category pills */}
                        <div className="flex flex-wrap gap-1">
                          {Object.keys(filteredLibrarySounds).map((cat) => (
                            <button
                              key={cat}
                              type="button"
                              onClick={() => setSelectedCategory(cat)}
                              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold transition border ${
                                selectedCategory === cat
                                  ? "bg-teal-600 text-white border-teal-600"
                                  : "bg-white text-slate-500 border-slate-200 hover:border-teal-300"
                              }`}
                            >
                              {cat} ({filteredLibrarySounds[cat].length})
                            </button>
                          ))}
                        </div>

                        {/* Sound list */}
                        {selectedCategory && filteredLibrarySounds[selectedCategory] && (
                          <div className="space-y-1.5 max-h-64 overflow-y-auto">
                            <p className="text-[10px] text-slate-400 italic">Drag a sound onto a page thumbnail to assign it</p>
                            {filteredLibrarySounds[selectedCategory].map((sound) => (
                              <div
                                key={`${selectedCategory}-${sound.name}`}
                                draggable
                                onDragStart={() => handleDragStart({ ...sound, category: selectedCategory! })}
                                onDragEnd={handleDragEnd}
                                className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 bg-white hover:border-teal-300 hover:shadow-sm cursor-grab active:cursor-grabbing transition-all group"
                              >
                                <GripHorizontal className="w-3 h-3 text-slate-300 group-hover:text-teal-400 shrink-0" />
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); toggleLibraryPreview(sound.url); }}
                                  className="w-6 h-6 flex items-center justify-center bg-teal-50 text-teal-600 rounded-full hover:bg-teal-100 shrink-0"
                                >
                                  {libraryPreviewUrl === sound.url ? (
                                    <Pause className="w-3 h-3" />
                                  ) : (
                                    <Play className="w-3 h-3 ml-0.5" />
                                  )}
                                </button>
                                <div className="min-w-0 flex-1">
                                  <div className="text-[11px] font-medium text-slate-700 truncate">
                                    {sound.name.replace(/_/g, " ").replace(/\.[^.]+$/, "")}
                                  </div>
                                  {sound.size && (
                                    <div className="text-[9px] text-slate-400">
                                      {(sound.size / 1024 / 1024).toFixed(1)} MB
                                    </div>
                                  )}
                                </div>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSoundscapeUrlInput(sound.url);
                                  }}
                                  className="text-[9px] text-teal-600 hover:text-teal-700 bg-teal-50 hover:bg-teal-100 px-1.5 py-0.5 rounded font-semibold shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                  title="Use this URL in the assignment field"
                                >
                                  Use
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "words" && (
            <PronunciationPanel
              bookId={bookId}
              selectedVoiceId={selectedVoiceId}
              voiceSettings={voiceSettings}
            />
          )}
        </div>
      </aside>

      {/* ─── Drop Assignment Dialog (overlay) ─────────────────────── */}
      {dropAssignment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 w-96 space-y-5">
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Music className="w-5 h-5 text-teal-500" />
                Assign Soundscape
              </h3>
              <p className="text-sm text-slate-500">
                <span className="font-medium text-slate-700">{dropAssignment.audioName}</span>
                {" → "}
                Page {dropAssignment.targetPage}
              </p>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-semibold text-slate-600">Scope</label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDropScope("single")}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-semibold border transition ${
                    dropScope === "single"
                      ? "bg-teal-600 text-white border-teal-600"
                      : "bg-white text-slate-600 border-slate-200 hover:border-teal-300"
                  }`}
                >
                  This Page Only
                </button>
                <button
                  type="button"
                  onClick={() => setDropScope("range")}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-semibold border transition ${
                    dropScope === "range"
                      ? "bg-teal-600 text-white border-teal-600"
                      : "bg-white text-slate-600 border-slate-200 hover:border-teal-300"
                  }`}
                >
                  Page Range
                </button>
              </div>

              {dropScope === "range" && (
                <div className="flex items-center gap-3 pt-1">
                  <label className="text-xs text-slate-500">From</label>
                  <input
                    type="number"
                    min={1}
                    max={localPages.length}
                    value={dropRangeStart}
                    onChange={(e) => setDropRangeStart(Number(e.target.value))}
                    className="w-20 rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-300"
                  />
                  <label className="text-xs text-slate-500">to</label>
                  <input
                    type="number"
                    min={dropRangeStart}
                    max={localPages.length}
                    value={dropRangeEnd}
                    onChange={(e) => setDropRangeEnd(Number(e.target.value))}
                    className="w-20 rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-300"
                  />
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDropAssignment(null)}
                className="flex-1 py-2.5 rounded-lg text-sm font-semibold border border-slate-200 text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDropAssignment}
                disabled={assignAudioPending}
                className="flex-1 py-2.5 rounded-lg text-sm font-semibold bg-teal-600 text-white hover:bg-teal-700 shadow-sm disabled:opacity-60"
              >
                {assignAudioPending ? "Assigning..." : "Assign"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
