"use client";

import { useState } from "react";
import {
  BookOpen,
  GripVertical,
  Image as ImageIcon,
  Plus,
  Pencil,
  PlayCircle,
  UploadCloud,
  ImagePlus,
  RefreshCw,
  Trash2,
  Bold,
  Italic,
  CheckCircle2,
  ArrowLeft,
  ArrowRight,
  Settings,
  Headphones,
  X,
  Pause,
  Volume2,
  Layers,
  Info,
  Mic,
  ArrowLeftRight,
  Play,
  Volume1,
  ChevronRight,
  CloudRain,
  Music,
  Upload,
} from "lucide-react";

export default function StoryCraftEditor() {
  const [activeTab, setActiveTab] = useState<"soundscape" | "narration">(
    "soundscape"
  );

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-800 overflow-hidden">
      {/* LEFT SIDEBAR: Navigator */}
      <aside className="w-72 bg-white border-r border-slate-200 flex flex-col shadow-[4px_0_24px_-12px_rgba(0,0,0,0.05)] z-20 shrink-0">
        {/* Sidebar Header */}
        <div className="h-16 flex items-center px-5 border-b border-slate-100">
          <div className="flex items-center gap-2 text-teal-600">
            <BookOpen className="w-6 h-6" />
            <span className="font-bold tracking-tight text-slate-900">
              Storia
            </span>
          </div>
        </div>

        {/* Page List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 px-1">
            Pages
          </div>

          {/* Page 1 (Thumbnail) */}
          <div className="group relative block cursor-pointer">
            <div className="absolute -left-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 text-slate-400">
              <GripVertical className="w-4 h-4" />
            </div>
            <div className="flex items-start gap-3">
              <span className="text-xs font-medium text-slate-400 w-4 pt-1">
                1
              </span>
              <div className="w-full aspect-[3/4] bg-white border border-slate-200 rounded-md overflow-hidden shadow-sm group-hover:shadow-md transition-all p-2 transform group-hover:-translate-y-0.5">
                <div className="w-full h-1/2 bg-teal-50 rounded-sm mb-2 overflow-hidden">
                  <div className="w-full h-full bg-slate-200 opacity-80" />
                </div>
                <div className="space-y-1">
                  <div className="h-1 w-full bg-slate-100 rounded-full"></div>
                  <div className="h-1 w-3/4 bg-slate-100 rounded-full"></div>
                  <div className="h-1 w-5/6 bg-slate-100 rounded-full"></div>
                </div>
              </div>
            </div>
          </div>

          {/* Page 2 (Thumbnail) */}
          <div className="group relative block cursor-pointer">
            <div className="absolute -left-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 text-slate-400">
              <GripVertical className="w-4 h-4" />
            </div>
            <div className="flex items-start gap-3">
              <span className="text-xs font-medium text-slate-400 w-4 pt-1">
                2
              </span>
              <div className="w-full aspect-[3/4] bg-white border border-slate-200 rounded-md overflow-hidden shadow-sm group-hover:shadow-md transition-all p-2 transform group-hover:-translate-y-0.5">
                <div className="w-full h-1/2 bg-slate-50 rounded-sm mb-2 flex items-center justify-center text-slate-300">
                  <ImageIcon className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <div className="h-1 w-full bg-slate-100 rounded-full"></div>
                  <div className="h-1 w-4/5 bg-slate-100 rounded-full"></div>
                </div>
              </div>
            </div>
          </div>

          {/* Page 3 (Active Thumbnail) */}
          <div className="group relative block cursor-pointer">
            <div className="absolute -left-2 top-1/2 -translate-y-1/2 opacity-100 text-teal-400">
              <GripVertical className="w-4 h-4" />
            </div>
            <div className="flex items-start gap-3">
              <span className="text-xs font-bold text-teal-600 w-4 pt-1">
                3
              </span>
              <div className="w-full aspect-[3/4] bg-white border-2 border-teal-500 ring-2 ring-teal-100 rounded-md overflow-hidden shadow-md p-2">
                <div className="w-full h-1/2 bg-slate-50 border border-dashed border-slate-200 rounded-sm mb-2 flex items-center justify-center">
                  <div className="w-4 h-4 rounded-full bg-teal-100 animate-pulse"></div>
                </div>
                <div className="space-y-1">
                  <div className="h-1 w-full bg-slate-200 rounded-full"></div>
                </div>
              </div>
            </div>
          </div>

          {/* Page 4 (Thumbnail) */}
          <div className="group relative block cursor-pointer">
            <div className="absolute -left-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 text-slate-400">
              <GripVertical className="w-4 h-4" />
            </div>
            <div className="flex items-start gap-3">
              <span className="text-xs font-medium text-slate-400 w-4 pt-1">
                4
              </span>
              <div className="w-full aspect-[3/4] bg-white border border-slate-200 rounded-md overflow-hidden shadow-sm group-hover:shadow-md transition-all p-2 transform group-hover:-translate-y-0.5">
                <div className="w-full h-1/2 bg-slate-50 rounded-sm mb-2"></div>
                <div className="space-y-1">
                  <div className="h-1 w-full bg-slate-100 rounded-full"></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Add Page Button */}
        <div className="p-4 border-t border-slate-100 bg-white">
          <button className="w-full flex items-center justify-center gap-2 py-3 bg-slate-50 hover:bg-slate-100 text-slate-600 font-medium rounded-lg border border-slate-200 border-dashed transition-all hover:border-teal-400 hover:text-teal-600 group">
            <Plus className="w-5 h-5 group-hover:scale-110 transition-transform" />
            Add Page
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col min-w-0 relative">
        {/* HEADER */}
        <header className="h-16 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-8 z-10 sticky top-0">
          {/* Book Title Ghost Input */}
          <div className="flex-1 max-w-xl group relative">
            <label htmlFor="book-title" className="sr-only">
              Book Title
            </label>
            <input
              type="text"
              id="book-title"
              defaultValue="The Adventures of Oliver"
              className="w-full text-lg font-semibold text-slate-800 bg-transparent border-2 border-transparent hover:border-slate-200 focus:border-teal-500 rounded-md px-2 py-1 transition-all outline-none truncate focus:bg-slate-50/50"
              placeholder="Untitled Book"
            />
            <Pencil className="w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 text-slate-300 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity" />
          </div>

          {/* Right Header Controls */}
          <div className="flex items-center gap-6">
            <div className="text-sm text-slate-500 font-medium bg-slate-100 px-3 py-1 rounded-full">
              Page 3 <span className="text-slate-300 mx-1">/</span> 10
            </div>

            <div className="h-6 w-px bg-slate-200"></div>

            <button className="flex items-center gap-2 text-slate-600 hover:text-teal-600 font-medium transition-colors">
              <PlayCircle className="w-5 h-5" />
              Preview
            </button>

            <button className="bg-teal-600 hover:bg-teal-700 text-white px-5 py-2 rounded-lg font-medium shadow-sm shadow-teal-600/20 transition-all flex items-center gap-2">
              Publish
              <UploadCloud className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* CANVAS AREA */}
        <div className="flex-1 bg-slate-50 overflow-y-auto overflow-x-hidden flex flex-col items-center py-10 px-4">
          {/* The Page (Card) */}
          <div className="w-full max-w-3xl aspect-[3/4] bg-white rounded-xl shadow-lg border border-slate-100 flex flex-col overflow-hidden relative group/page">
            {/* SECTION 1: Illustration Placeholder (Top) */}
            <div className="h-[55%] bg-slate-50/50 relative p-6 flex flex-col border-b border-slate-100">
              {/* The Drop Zone Container */}
              <div className="w-full h-full border-2 border-dashed border-slate-300 rounded-xl bg-white hover:bg-slate-50 transition-colors flex flex-col items-center justify-center text-slate-400 cursor-pointer relative group/image overflow-hidden">
                {/* Empty State Content */}
                <div className="flex flex-col items-center text-center p-6 transition-opacity group-hover/image:opacity-100">
                  <div className="w-16 h-16 bg-teal-50 text-teal-500 rounded-full flex items-center justify-center mb-4">
                    <ImagePlus className="w-8 h-8" />
                  </div>
                  <h3 className="text-slate-700 font-medium text-lg mb-1">
                    Add an Illustration
                  </h3>
                  <p className="text-sm text-slate-400 mb-4">
                    Click to upload or drag & drop
                  </p>
                  <span className="text-xs text-slate-300 px-2 py-1 bg-slate-100 rounded">
                    Supports JPG, PNG, GIF
                  </span>
                </div>

                {/* Active State Simulation */}
                <div className="absolute inset-0 bg-slate-900/0 hover:bg-slate-900/40 transition-all flex items-center justify-center gap-3 opacity-0 hover:opacity-100">
                  <button className="bg-white text-slate-700 hover:text-teal-600 px-4 py-2 rounded-lg shadow-lg font-medium text-sm flex items-center gap-2 transform translate-y-4 hover:translate-y-0 transition-all duration-300">
                    <RefreshCw className="w-4 h-4" />
                    Change
                  </button>
                  <button className="bg-white/90 text-red-500 hover:bg-white px-4 py-2 rounded-lg shadow-lg font-medium text-sm flex items-center gap-2 transform translate-y-4 hover:translate-y-0 transition-all duration-300 delay-75">
                    <Trash2 className="w-4 h-4" />
                    Remove
                  </button>
                </div>
              </div>
            </div>

            {/* SECTION 2: Text Area (Bottom) */}
            <div className="flex-1 p-10 bg-white relative">
              <textarea
                className="w-full h-full resize-none outline-none border-none text-xl leading-relaxed text-slate-700 placeholder:text-slate-300 font-serif bg-transparent"
                placeholder="Start writing your story here... Once upon a time, in a land far away..."
              ></textarea>

              {/* Floating Format Toolbar */}
              <div className="absolute bottom-6 right-6 flex gap-1 opacity-0 group-focus-within/page:opacity-100 transition-opacity duration-500">
                <button
                  className="p-2 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-700 transition-colors"
                  title="Bold"
                >
                  <Bold className="w-4 h-4" />
                </button>
                <button
                  className="p-2 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-700 transition-colors"
                  title="Italic"
                >
                  <Italic className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Spacer for scrolling */}
          <div className="h-24 w-full"></div>
        </div>

        {/* FOOTER CONTROLS */}
        <div className="h-20 bg-white border-t border-slate-200 flex items-center justify-between px-8 absolute bottom-0 w-full z-10 shadow-[0_-4px_20px_rgba(0,0,0,0.02)]">
          {/* Autosave Status */}
          <div className="flex items-center gap-2 w-1/3">
            <div className="flex items-center gap-1.5 text-teal-600 bg-teal-50 px-3 py-1.5 rounded-full text-xs font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Saved
            </div>
            <span className="text-xs text-slate-400 ml-2">
              Last edit just now
            </span>
          </div>

          {/* Navigation */}
          <div className="flex items-center gap-4 w-1/3 justify-center">
            <button className="p-3 rounded-full hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-all hover:-translate-x-1 active:scale-95 disabled:opacity-30">
              <ArrowLeft className="w-5 h-5" />
            </button>

            <span className="text-lg font-serif text-slate-800 min-w-[3rem] text-center">
              3
            </span>

            <button className="p-3 rounded-full bg-slate-900 text-white hover:bg-slate-800 shadow-lg shadow-slate-900/20 transition-all hover:translate-x-1 active:scale-95">
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>

          {/* Empty right side for balance or auxiliary tools */}
          <div className="w-1/3 flex justify-end gap-4">
            <button className="text-slate-400 hover:text-slate-600 transition-colors flex items-center gap-2 text-sm font-medium">
              <Settings className="w-4.5 h-4.5" />
              Settings
            </button>
          </div>
        </div>
      </main>

      {/* RIGHT SIDEBAR: Audio Management */}
      <aside className="w-80 bg-white border-l border-slate-200 flex flex-col shadow-[-4px_0_24px_-12px_rgba(0,0,0,0.05)] z-20 shrink-0">
        {/* Sidebar Header */}
        <div className="h-16 flex items-center px-6 border-b border-slate-100 bg-white/50 backdrop-blur-sm">
          <div className="flex items-center gap-2.5 text-slate-800">
            <Headphones className="w-6 h-6 text-amber-500" />
            <span className="font-bold tracking-tight">Audio Manager</span>
          </div>
        </div>

        {/* Content Scrollable */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Section: Applied Soundscape */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Ambient Soundscape
              </h4>
              <span className="text-[10px] text-green-600 bg-green-50 px-2 py-0.5 rounded-full font-medium border border-green-100">
                Active
              </span>
            </div>

            {/* Active Audio Card */}
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-4 border border-amber-100 shadow-sm relative group">
              {/* Top Row: Info + Remove */}
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-800 leading-tight">
                    Forest Ambience
                  </h3>
                  <span className="text-xs text-amber-600/80 font-medium">
                    00:45 • Looping
                  </span>
                </div>
                <button className="text-slate-400 hover:text-red-500 transition-colors p-1 -mr-1 rounded hover:bg-white/50">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Waveform Visualization */}
              <div className="flex items-center justify-between gap-0.5 h-6 mb-4 px-1 opacity-80">
                {[3, 2, 4, 2, 5, 3, 2, 4, 3, 5, 2, 4, 3, 2, 4].map(
                  (h, i) => (
                    <div
                      key={i}
                      className={`w-1 bg-amber-400 rounded-full ${
                        h === 2
                          ? "h-2 bg-amber-300"
                          : h === 3
                          ? "h-3"
                          : h === 4
                          ? "h-4"
                          : "h-5 bg-amber-500"
                      }`}
                    ></div>
                  )
                )}
              </div>

              {/* Controls: Play + Volume */}
              <div className="flex items-center gap-3">
                <button className="w-8 h-8 flex items-center justify-center bg-amber-500 text-white rounded-full hover:bg-amber-600 shadow-sm transition-transform active:scale-95">
                  <Pause className="w-3.5 h-3.5" />
                </button>
                <input
                  type="range"
                  min="0"
                  max="100"
                  defaultValue="60"
                  className="w-full h-1 bg-amber-200 rounded-lg appearance-none cursor-pointer accent-amber-500"
                />
                <Volume2 className="w-3 h-3 text-amber-400" />
              </div>

              {/* Page Range Assignment */}
              <div className="pt-2 mt-3 border-t border-amber-100">
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex items-center gap-1.5 px-2 py-1 bg-white/60 rounded text-xs font-medium text-amber-700 border border-amber-100/50 shadow-sm">
                    <Layers className="w-2.5 h-2.5" />
                    Pages 3-5
                  </div>
                  <button className="text-[10px] text-slate-400 hover:text-amber-600 underline decoration-dotted">
                    Edit Range
                  </button>
                </div>
              </div>
            </div>
          </div>

          <hr className="border-slate-100" />

          {/* Section: Voice Narration (NEW) */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Voice Narration
              </h4>
              <div className="group/tooltip relative">
                <Info className="w-3 h-3 text-slate-300 hover:text-slate-500 cursor-help align-middle" />
                {/* Tooltip */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-slate-800 text-white text-[10px] p-2 rounded shadow-lg opacity-0 group-hover/tooltip:opacity-100 pointer-events-none transition-opacity z-50 text-center">
                  Narration is a voice overlay, distinct from ambient background
                  audio.
                </div>
              </div>
            </div>

            {/* Narration Card (Active State) */}
            <div className="bg-gradient-to-br from-orange-50 to-yellow-50 rounded-xl p-4 border border-orange-200 shadow-sm relative group">
              {/* Header & Info */}
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-100 to-yellow-100 text-orange-600 flex items-center justify-center shrink-0 border border-orange-100 shadow-sm">
                    <Mic className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800 leading-tight">
                      Chapter 1 Reading
                    </h3>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                      <span className="text-xs text-orange-700/70 font-medium">
                        02:14 • Voice
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    title="Replace Narration"
                    className="text-slate-400 hover:text-orange-600 transition-colors p-1.5 rounded-md hover:bg-orange-100/50"
                  >
                    <ArrowLeftRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    title="Remove"
                    className="text-slate-400 hover:text-red-500 transition-colors p-1.5 rounded-md hover:bg-red-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Narration Waveform (Bronze/Gold Theme) */}
              <div className="bg-white/40 rounded-lg p-2 mb-3 border border-orange-100/50">
                <div className="flex items-center justify-between gap-0.5 h-8 opacity-90">
                  {/* Simulated voice waveform */}
                  {[
                    2, 3, 5, 3, 2, 4, 6, 4, 2, 1, 3, 5, 2, 4, 3, 1, 2, 4,
                  ].map((h, i) => (
                    <div
                      key={i}
                      className={`w-1 rounded-full ${
                        h === 1
                          ? "h-1 bg-orange-200"
                          : h === 2
                          ? "h-2 bg-orange-300"
                          : h === 3
                          ? "h-3 bg-orange-400"
                          : h === 4
                          ? "h-4 bg-orange-500"
                          : h === 5
                          ? "h-5 bg-orange-500"
                          : "h-6 bg-orange-600"
                      }`}
                    ></div>
                  ))}
                </div>
              </div>

              {/* Playback Controls */}
              <div className="flex items-center gap-3">
                <button className="w-8 h-8 flex items-center justify-center bg-orange-600 text-white rounded-full hover:bg-orange-700 shadow-md shadow-orange-600/20 transition-all hover:scale-105 active:scale-95">
                  <Play className="w-3.5 h-3.5 ml-0.5" />
                </button>
                <div className="flex-1 flex items-center gap-2">
                  <Volume1 className="w-3 h-3 text-orange-600/60" />
                  <input
                    type="range"
                    min="0"
                    max="100"
                    defaultValue="85"
                    className="w-full h-1 bg-orange-200 rounded-lg appearance-none cursor-pointer accent-orange-600"
                  />
                </div>
              </div>

              {/* Assignment Toggle */}
              <div className="mt-4 pt-3 border-t border-orange-200/60 flex items-center justify-between">
                <label className="text-xs font-medium text-slate-500">
                  Applied to:
                </label>
                <div className="flex bg-white/60 rounded-lg p-0.5 border border-orange-200/50">
                  <button className="px-2.5 py-1 text-[10px] font-semibold rounded-md bg-white shadow-sm text-orange-700 border border-orange-100">
                    Current Page
                  </button>
                  <button className="px-2.5 py-1 text-[10px] font-medium rounded-md text-slate-500 hover:bg-white/50 hover:text-slate-700 transition-colors">
                    Range
                  </button>
                </div>
              </div>
            </div>
          </div>

          <hr className="border-slate-100" />

          {/* Section: Library (Existing) */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Soundscape Library
              </h4>
              <button className="text-xs text-amber-600 font-medium hover:text-amber-700 flex items-center gap-1">
                Browse All <ChevronRight className="w-3 h-3" />
              </button>
            </div>

            {/* Track List */}
            <div className="space-y-2">
              {/* Track Item 1 */}
              <div className="group flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-all cursor-pointer">
                <div className="w-8 h-8 rounded bg-indigo-50 text-indigo-400 flex items-center justify-center shrink-0">
                  <CloudRain className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <h5 className="text-sm font-medium text-slate-700 truncate">
                    Heavy Rainfall
                  </h5>
                  <span className="text-[10px] text-slate-400">
                    01:20 • Ambience
                  </span>
                </div>
                <button className="opacity-0 group-hover:opacity-100 bg-white border border-slate-200 text-slate-600 hover:text-amber-600 hover:border-amber-200 px-2.5 py-1 rounded text-xs font-medium transition-all shadow-sm">
                  Use
                </button>
              </div>

              {/* Track Item 2 */}
              <div className="group flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-all cursor-pointer">
                <div className="w-8 h-8 rounded bg-rose-50 text-rose-400 flex items-center justify-center shrink-0">
                  <Music className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <h5 className="text-sm font-medium text-slate-700 truncate">
                    Soft Piano Theme
                  </h5>
                  <span className="text-[10px] text-slate-400">
                    02:15 • Music
                  </span>
                </div>
                <button className="opacity-0 group-hover:opacity-100 bg-white border border-slate-200 text-slate-600 hover:text-amber-600 hover:border-amber-200 px-2.5 py-1 rounded text-xs font-medium transition-all shadow-sm">
                  Use
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer: Upload */}
        <div className="p-4 border-t border-slate-100 bg-white">
          <button className="w-full flex items-center justify-center gap-2 py-3 bg-slate-50 hover:bg-slate-100 text-slate-600 font-medium rounded-lg border border-slate-200 border-dashed transition-all hover:text-amber-600 hover:border-amber-300 group">
            <Upload className="w-5 h-5 group-hover:-translate-y-0.5 transition-transform" />
            Upload Audio File
          </button>
        </div>
      </aside>
    </div>
  );
}