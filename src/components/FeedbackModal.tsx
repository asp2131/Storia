"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Sparkles, Star, Send } from "lucide-react";

type FeedbackModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (rating: number, feedback?: string) => Promise<void>;
  onSkip: () => void;
};

export default function FeedbackModal({
  isOpen,
  onClose,
  onSubmit,
  onSkip,
}: FeedbackModalProps) {
  const [rating, setRating] = useState<number>(0);
  const [hoveredRating, setHoveredRating] = useState<number>(0);
  const [feedback, setFeedback] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  const MAX_CHARS = 200;

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setRating(0);
      setHoveredRating(0);
      setFeedback("");
      setIsSubmitting(false);
      setShowSuccess(false);
      setIsClosing(false);
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !isSubmitting) {
        handleSkip();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isSubmitting]);

  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 300);
  }, [onClose]);

  const handleSkip = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      onSkip();
    }, 300);
  }, [onSkip]);

  const handleSubmit = async () => {
    if (rating === 0 || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onSubmit(rating, feedback.trim() || undefined);
      setShowSuccess(true);
      setTimeout(() => {
        handleClose();
      }, 1500);
    } catch (error) {
      console.error("Failed to submit feedback:", error);
      setIsSubmitting(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isSubmitting) {
      handleSkip();
    }
  };

  const displayRating = hoveredRating || rating;

  if (!isOpen) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-opacity duration-300 ${
        isClosing ? "opacity-0" : "opacity-100"
      }`}
      onClick={handleBackdropClick}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal Panel */}
      <div
        className={`relative w-full max-w-[440px] overflow-hidden rounded-2xl border border-white/[0.08] bg-slate-900/95 shadow-2xl backdrop-blur-xl transition-all duration-400 ${
          isClosing
            ? "translate-y-5 opacity-0"
            : "translate-y-0 opacity-100 animate-slide-up"
        }`}
        style={{
          boxShadow:
            "0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255,255,255,0.05)",
        }}
      >
        {/* Close Button */}
        <button
          onClick={handleSkip}
          disabled={isSubmitting}
          className="absolute right-4 top-4 z-10 rounded-full p-2 text-slate-400 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50 group"
          aria-label="Close feedback"
        >
          <X className="h-5 w-5 transition-transform duration-300 group-hover:rotate-90" />
        </button>

        {/* Content */}
        <div className="flex flex-col items-center p-6 text-center md:p-8">
          {showSuccess ? (
            /* Success State */
            <div className="flex flex-col items-center py-8 animate-fade-in">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-teal-500/30 to-teal-600/10 border border-teal-500/30">
                <Sparkles className="h-8 w-8 text-teal-400" />
              </div>
              <h2 className="font-serif text-2xl font-medium text-white">
                Thank you!
              </h2>
              <p className="mt-2 text-sm text-slate-400">
                Your feedback helps us improve
              </p>
            </div>
          ) : (
            /* Form State */
            <>
              {/* Icon */}
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full border border-teal-500/20 bg-gradient-to-br from-teal-500/20 to-teal-600/5 shadow-inner">
                <Sparkles className="h-6 w-6 text-teal-400" />
              </div>

              {/* Headers */}
              <h2 className="mb-2 font-serif text-2xl font-medium text-white">
                How&apos;s your reading?
              </h2>
              <p className="mb-8 max-w-[280px] text-sm leading-relaxed text-slate-400 md:text-[15px]">
                Your feedback helps us create better stories for the Storia
                community.
              </p>

              {/* Star Rating */}
              <div className="mb-8 w-full">
                <div className="mb-2 flex flex-row-reverse justify-center gap-1">
                  {[5, 4, 3, 2, 1].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      onMouseEnter={() => setHoveredRating(star)}
                      onMouseLeave={() => setHoveredRating(0)}
                      disabled={isSubmitting}
                      className="p-2 transition-all duration-200 disabled:opacity-50 focus:outline-none"
                      style={{
                        color: displayRating >= star ? "#fbbf24" : "#475569",
                        transform:
                          hoveredRating >= star ? "scale(1.15)" : "scale(1)",
                        textShadow:
                          displayRating >= star
                            ? "0 0 12px rgba(251, 191, 36, 0.4)"
                            : "none",
                      }}
                      aria-label={`Rate ${star} star${star > 1 ? "s" : ""}`}
                    >
                      <Star
                        className="h-8 w-8"
                        fill={displayRating >= star ? "currentColor" : "none"}
                        strokeWidth={1.5}
                      />
                    </button>
                  ))}
                </div>
                <p
                  className={`h-4 text-xs font-medium uppercase tracking-widest transition-all duration-300 ${
                    rating > 0 ? "text-amber-500" : "text-slate-500"
                  }`}
                >
                  {rating > 0 ? "Thanks for rating!" : "Tap to rate"}
                </p>
              </div>

              {/* Feedback Input */}
              <div className="relative mb-6 w-full group">
                <textarea
                  value={feedback}
                  onChange={(e) =>
                    setFeedback(e.target.value.slice(0, MAX_CHARS))
                  }
                  disabled={isSubmitting}
                  rows={3}
                  className="peer w-full resize-none rounded-xl border border-slate-700/50 bg-slate-950/50 p-4 text-sm text-slate-200 placeholder-slate-600 transition-all focus:border-teal-500/50 focus:outline-none focus:ring-2 focus:ring-teal-500/50 disabled:opacity-50"
                  placeholder="What could we improve? (optional)"
                />
                <div className="absolute bottom-3 right-3 font-mono text-[10px] text-slate-600 opacity-0 transition-opacity peer-focus:opacity-100">
                  {feedback.length} / {MAX_CHARS}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex w-full flex-col gap-3">
                {/* Primary Action */}
                <button
                  onClick={handleSubmit}
                  disabled={rating === 0 || isSubmitting}
                  className={`group flex w-full items-center justify-center gap-2 rounded-xl py-3.5 font-medium shadow-lg transition-all duration-200 active:scale-[0.98] ${
                    rating > 0
                      ? "bg-teal-600 text-white shadow-teal-900/20 hover:bg-teal-500"
                      : "cursor-not-allowed bg-slate-700 text-slate-400"
                  } disabled:opacity-50`}
                >
                  <span>{isSubmitting ? "Sending..." : "Send Feedback"}</span>
                  {!isSubmitting && (
                    <Send className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  )}
                </button>

                {/* Secondary Action */}
                <button
                  onClick={handleSkip}
                  disabled={isSubmitting}
                  className="w-full rounded-xl py-3 text-sm font-medium text-slate-500 transition-colors hover:bg-white/5 hover:text-slate-300 disabled:opacity-50"
                >
                  Maybe later
                </button>
              </div>
            </>
          )}
        </div>

        {/* Decorative Bottom Edge */}
        <div className="h-1 w-full bg-gradient-to-r from-teal-500/0 via-teal-500/30 to-teal-500/0" />
      </div>
    </div>
  );
}
