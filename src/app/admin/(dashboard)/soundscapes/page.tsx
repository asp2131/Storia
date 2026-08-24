"use client";

export const dynamic = 'force-dynamic';

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type SoundscapeAsset = {
  name: string;
  size?: number | null;
  updatedAt?: string | null;
  url: string;
};

export default function AdminSoundscapesPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [categories, setCategories] = useState<Record<string, SoundscapeAsset[]>>({});
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadDragging, setUploadDragging] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  const audioInputRef = useRef<HTMLInputElement>(null);

  const bucket = useMemo(
    () => process.env.NEXT_PUBLIC_SUPABASE_SOUNDSCAPE_BUCKET || "storia-storage",
    []
  );
  const basePath = useMemo(
    () => process.env.NEXT_PUBLIC_SUPABASE_SOUNDSCAPE_BASE_PATH || "audio/curated",
    []
  );

  const loadSoundscapes = useCallback(async () => {
    setLoading(true);
    setError(null);
    const response = await fetch(
      `/api/soundscapes?bucket=${encodeURIComponent(bucket)}&basePath=${encodeURIComponent(basePath)}`
    );
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setError(payload?.error || "Failed to load soundscapes.");
      setLoading(false);
      return;
    }
    const payload = await response.json();
    const categoriesMap = payload?.categories ?? {};
    const categoryNames = Object.keys(categoriesMap);
    setCategories(categoriesMap);
    setSelectedCategory((prev) =>
      prev && categoryNames.includes(prev) ? prev : categoryNames[0] ?? null
    );
    setLoading(false);
  }, [bucket, basePath]);

  useEffect(() => {
    loadSoundscapes();
  }, [loadSoundscapes]);

  const handleUpload = async (file: File) => {
    if (!file.type.startsWith("audio/") && !file.name.match(/\.(mp3|wav|ogg|flac|aac|m4a|webm)$/i)) {
      setUploadError("Please upload a valid audio file.");
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setUploadError("File too large. Maximum size is 50MB.");
      return;
    }
    setUploading(true);
    setUploadError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/admin/audio-uploads", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || "Failed to upload audio.");
      }
      await loadSoundscapes();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Failed to upload audio.");
    } finally {
      setUploading(false);
    }
  };

  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setUploadDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleUpload(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
  };

  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex flex-col gap-[7px] border-b-2 border-[var(--studio-ink)] pb-[18px]">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--studio-ink-muted)]">Curated library</span>
          <h1 className="m-0 font-serif text-[44px] font-medium leading-none tracking-[-0.025em]">Soundscapes</h1>
        </div>
        <p className="text-[var(--studio-ink-muted)] text-sm">
          Manage curated and uploaded soundscapes stored in Supabase.
        </p>
      </div>

      {/* Upload Section */}
      <section className="bg-[var(--studio-card)] border border-[var(--studio-rule)] rounded-2xl p-6 space-y-4">
        <h2 className="text-[var(--studio-ink)] text-sm font-bold">Upload Audio</h2>
        <input
          ref={audioInputRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={handleFileChange}
        />
        <div
          onDragOver={(e) => { e.preventDefault(); setUploadDragging(true); }}
          onDragLeave={() => setUploadDragging(false)}
          onDrop={handleFileDrop}
          onClick={() => audioInputRef.current?.click()}
          className={`rounded-xl border-2 border-dashed p-8 flex flex-col items-center gap-3 cursor-pointer transition-all ${
            uploadDragging
              ? "border-[var(--studio-coral)] bg-[var(--studio-coral)]/10"
              : "border-[var(--studio-rule)] hover:border-[var(--studio-rule-strong)] hover:bg-[var(--studio-paper)]"
          }`}
        >
          {uploading ? (
            <div className="flex items-center gap-3">
              <svg className="animate-spin h-5 w-5 text-[var(--studio-coral)]" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span className="text-[var(--studio-ink-muted)] text-sm">Uploading...</span>
            </div>
          ) : (
            <>
              <div className="w-10 h-10 rounded-full bg-[var(--studio-coral)]/10 flex items-center justify-center">
                <svg className="w-5 h-5 text-[var(--studio-coral)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <p className="text-[var(--studio-ink)] text-sm font-medium">Drop audio files or click to browse</p>
              <p className="text-[var(--studio-ink-muted)] text-xs">MP3, WAV, OGG, FLAC, AAC, M4A, WebM &bull; Max 50MB</p>
            </>
          )}
        </div>
        {uploadError && (
          <p className="text-[var(--studio-changes-ink)] text-xs">{uploadError}</p>
        )}
      </section>

      {/* Library Section */}
      <section className="bg-[var(--studio-card)] border border-[var(--studio-rule)] rounded-2xl p-6">
        {loading && <p className="text-[var(--studio-ink-muted)] text-sm">Loading soundscapes...</p>}
        {error && (
          <p className="text-[var(--studio-changes-ink)] text-sm">
            Failed to load soundscapes: {error}
          </p>
        )}
        {!loading && !error && Object.keys(categories).length === 0 && (
          <p className="text-[var(--studio-ink-muted)] text-sm">
            No soundscapes found in {`"${bucket}/${basePath}"`}.
          </p>
        )}
        {!loading && !error && Object.keys(categories).length > 0 && (
          <div className="space-y-5">
            <div className="flex flex-wrap gap-2">
              {Object.keys(categories).map((category) => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition border ${
                    selectedCategory === category
                      ? "bg-[var(--studio-coral)] text-[var(--studio-on-coral)] border-[var(--studio-coral)]"
                      : "bg-[var(--studio-paper)] text-[var(--studio-ink-muted)] border-[var(--studio-rule)] hover:text-white hover:border-[var(--studio-rule-strong)]"
                  }`}
                >
                  {category} ({categories[category].length})
                </button>
              ))}
            </div>

            {selectedCategory ? (
              <div className="space-y-4">
                {(categories[selectedCategory] || []).map((asset) => (
                  <div
                    key={`${selectedCategory}-${asset.name}`}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-[var(--studio-rule)] bg-[var(--studio-paper)] p-4"
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <p className="text-[var(--studio-ink)] text-sm font-semibold truncate">
                        {asset.name.replace(/_/g, " ")}
                      </p>
                      <p className="text-[var(--studio-ink-muted)] text-xs">
                        {selectedCategory}
                        {asset.updatedAt
                          ? ` • Updated ${new Date(asset.updatedAt).toLocaleString()}`
                          : ""}
                        {asset.size
                          ? ` • ${(asset.size / 1024 / 1024).toFixed(2)} MB`
                          : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <audio controls className="w-full sm:w-56">
                        <source src={asset.url} />
                        Your browser does not support the audio element.
                      </audio>
                      <button
                        type="button"
                        onClick={() => copyUrl(asset.url)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition border ${
                          copiedUrl === asset.url
                            ? "bg-green-600 text-[var(--studio-ink)] border-green-600"
                            : "bg-[var(--studio-paper)] text-[var(--studio-ink-muted)] border-[var(--studio-rule)] hover:text-white hover:border-[var(--studio-rule-strong)]"
                        }`}
                      >
                        {copiedUrl === asset.url ? "Copied!" : "Copy URL"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-10 rounded-xl border border-dashed border-[var(--studio-rule)] text-[var(--studio-ink-muted)] text-sm">
                Select a category to browse soundscapes.
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
