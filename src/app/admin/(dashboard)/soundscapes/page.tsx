"use client";

import { useEffect, useMemo, useState } from "react";

type SoundscapeAsset = {
  name: string;
  size?: number | null;
  updatedAt?: string | null;
  url: string;
};

export default function AdminSoundscapesPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<Record<string, SoundscapeAsset[]>>(
    {}
  );
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const bucket = useMemo(
    () => process.env.NEXT_PUBLIC_SUPABASE_SOUNDSCAPE_BUCKET || "storia-storage",
    []
  );
  const basePath = useMemo(
    () => process.env.NEXT_PUBLIC_SUPABASE_SOUNDSCAPE_BASE_PATH || "audio/curated",
    []
  );

  useEffect(() => {
    let active = true;
    const loadSoundscapes = async () => {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `/api/soundscapes?bucket=${encodeURIComponent(bucket)}&basePath=${encodeURIComponent(basePath)}`
      );
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        if (!active) return;
        setError(payload?.error || "Failed to load soundscapes.");
        setLoading(false);
        return;
      }

      const payload = await response.json();
      if (!active) return;

      const categoriesMap = payload?.categories ?? {};
      const categoryNames = Object.keys(categoriesMap);
      setCategories(categoriesMap);
      setSelectedCategory((prev) =>
        prev && categoryNames.includes(prev) ? prev : categoryNames[0] ?? null
      );
      setLoading(false);
    };

    loadSoundscapes();
    return () => {
      active = false;
    };
  }, [basePath, bucket]);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-black font-serif">Soundscapes</h1>
        <p className="text-[#929bc9] text-sm">
          Manage curated and generated soundscapes stored in Supabase.
        </p>
      </div>

      <section className="bg-[#101322] border border-[#232948] rounded-2xl p-6">
        {loading && <p className="text-[#929bc9] text-sm">Loading soundscapes...</p>}
        {error && (
          <p className="text-red-300 text-sm">
            Failed to load soundscapes: {error}
          </p>
        )}
        {!loading && !error && Object.keys(categories).length === 0 && (
          <p className="text-[#929bc9] text-sm">
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
                      ? "bg-[#1337ec] text-white border-[#1337ec]"
                      : "bg-[#0f1419] text-[#929bc9] border-[#232948] hover:text-white hover:border-[#2f3761]"
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>

            {selectedCategory ? (
              <div className="space-y-4">
                {(categories[selectedCategory] || []).map((asset) => (
                  <div
                    key={`${selectedCategory}-${asset.name}`}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-[#232948] bg-[#0f1419] p-4"
                  >
                    <div className="space-y-1">
                      <p className="text-white text-sm font-semibold">
                        {asset.name.replace(/_/g, " ")}
                      </p>
                      <p className="text-[#929bc9] text-xs">
                        {selectedCategory}
                        {asset.updatedAt
                          ? ` • Updated ${new Date(asset.updatedAt).toLocaleString()}`
                          : ""}
                        {asset.size
                          ? ` • ${(asset.size / 1024 / 1024).toFixed(2)} MB`
                          : ""}
                      </p>
                    </div>
                    <audio controls className="w-full sm:w-72">
                      <source src={asset.url} />
                      Your browser does not support the audio element.
                    </audio>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-10 rounded-xl border border-dashed border-[#232948] text-[#929bc9] text-sm">
                Select a category to browse soundscapes.
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}