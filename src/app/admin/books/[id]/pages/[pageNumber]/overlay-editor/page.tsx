"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ChevronRight, Loader2, X } from "lucide-react";
import {
  DraggableTextOverlayEditor,
} from "@/components/text-overlay/DraggableTextOverlayEditor";
import {
  TextOverlayConfig,
  emptyOverlayConfig,
} from "@/types/text-overlay";

interface OverlayApiResponse {
  overlay: TextOverlayConfig | null;
  imageUrl: string | null;
  compositedImageUrl: string | null;
  compositedAt: string | null;
}

interface BookApiResponse {
  id: string;
  title: string;
}

export default function OverlayEditorPage() {
  const params = useParams();
  const id = params.id as string;
  const pageNumber = parseInt(params.pageNumber as string, 10);

  // State
  const [overlay, setOverlay] = useState<TextOverlayConfig | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [compositedImageUrl, setCompositedImageUrl] = useState<string | null>(null);
  const [compositedAt, setCompositedAt] = useState<string | null>(null);
  const [bookTitle, setBookTitle] = useState<string>("Untitled Book");
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isCompositing, setIsCompositing] = useState(false);
  
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [compositeError, setCompositeError] = useState<string | null>(null);

  // Fetch data on mount
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Fetch book data
        const bookRes = await fetch(`/api/admin/books/${id}`);
        if (!bookRes.ok) {
          throw new Error("Failed to load book data");
        }
        const bookData: BookApiResponse = await bookRes.json();
        setBookTitle(bookData.title || "Untitled Book");

        // Fetch overlay data
        const overlayRes = await fetch(
          `/api/admin/books/${id}/pages/${pageNumber}/overlay`
        );
        if (!overlayRes.ok) {
          throw new Error("Failed to load overlay data");
        }
        const data: OverlayApiResponse = await overlayRes.json();

        setOverlay(data.overlay || emptyOverlayConfig());
        setImageUrl(data.imageUrl);
        setCompositedImageUrl(data.compositedImageUrl);
        setCompositedAt(data.compositedAt);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "An unexpected error occurred"
        );
      } finally {
        setIsLoading(false);
      }
    };

    if (id && !isNaN(pageNumber)) {
      fetchData();
    }
  }, [id, pageNumber]);

  // Handle save
  const handleSave = async (updatedOverlay: TextOverlayConfig) => {
    setIsSaving(true);
    setSaveError(null);

    try {
      const res = await fetch(
        `/api/admin/books/${id}/pages/${pageNumber}/overlay`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ overlay: updatedOverlay }),
        }
      );

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to save overlay");
      }

      const data = await res.json();
      setOverlay(data.overlay || updatedOverlay);
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : "Failed to save overlay"
      );
    } finally {
      setIsSaving(false);
    }
  };

  // Handle composite
  const handleComposite = async () => {
    setIsCompositing(true);
    setCompositeError(null);

    try {
      const res = await fetch(
        `/api/admin/books/${id}/pages/${pageNumber}/composite`,
        {
          method: "POST",
        }
      );

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to composite image");
      }

      const data = await res.json();
      setCompositedImageUrl(data.compositedImageUrl || null);
      setCompositedAt(data.compositedAt || null);
    } catch (err) {
      setCompositeError(
        err instanceof Error ? err.message : "Failed to composite image"
      );
    } finally {
      setIsCompositing(false);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <span className="text-gray-600">Loading overlay editor...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-lg max-w-md text-center">
          <h2 className="font-semibold mb-2">Error</h2>
          <p>{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Main editor
  return (
    <div className="h-screen flex flex-col">
      {/* Header with breadcrumbs */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 shrink-0">
        <nav className="flex items-center gap-2 text-sm">
          <Link
            href="/admin/books"
            className="text-blue-600 hover:text-blue-800"
          >
            Books
          </Link>
          <ChevronRight className="w-4 h-4 text-gray-400" />
          <Link
            href={`/admin/books/${id}`}
            className="text-blue-600 hover:text-blue-800 truncate max-w-xs"
            title={bookTitle}
          >
            {bookTitle}
          </Link>
          <ChevronRight className="w-4 h-4 text-gray-400" />
          <span className="text-gray-900 font-medium">Page {pageNumber}</span>
          <ChevronRight className="w-4 h-4 text-gray-400" />
          <span className="text-gray-900 font-medium">Overlay Editor</span>
        </nav>
      </header>

      {/* Error alerts */}
      {saveError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 m-4 rounded-lg flex items-start gap-3">
          <span className="flex-1">{saveError}</span>
          <button
            onClick={() => setSaveError(null)}
            className="text-red-500 hover:text-red-700"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {compositeError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 m-4 rounded-lg flex items-start gap-3">
          <span className="flex-1">{compositeError}</span>
          <button
            onClick={() => setCompositeError(null)}
            className="text-red-500 hover:text-red-700"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Editor */}
      {imageUrl && overlay && (
        <div className="flex-1 overflow-hidden">
          <DraggableTextOverlayEditor
            imageUrl={imageUrl}
            overlay={overlay}
            onSave={handleSave}
            onComposite={handleComposite}
            isSaving={isSaving}
            isCompositing={isCompositing}
          />
        </div>
      )}

      {/* No image warning */}
      {!imageUrl && !isLoading && (
        <div className="flex-1 flex items-center justify-center bg-gray-50">
          <div className="bg-amber-50 border border-amber-200 text-amber-800 px-6 py-4 rounded-lg max-w-md text-center">
            <h2 className="font-semibold mb-2">No Image Available</h2>
            <p>
              This page does not have an illustration. Please add an image
              before editing overlays.
            </p>
            <Link
              href={`/admin/books/${id}/edit`}
              className="mt-4 inline-block px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
            >
              Go to Book Editor
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
