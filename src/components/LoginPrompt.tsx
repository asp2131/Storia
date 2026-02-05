"use client";

import { useState, useEffect, useCallback } from "react";
import { X, LogIn } from "lucide-react";
import Link from "next/link";

const SESSION_STORAGE_KEY = "login_prompt_dismissed";

type LoginPromptProps = {
  show: boolean;
  onDismiss: () => void;
};

export default function LoginPrompt({ show, onDismiss }: LoginPromptProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  // Check sessionStorage on mount and handle visibility
  useEffect(() => {
    if (show) {
      const isDismissed = sessionStorage.getItem(SESSION_STORAGE_KEY) === "true";
      if (!isDismissed) {
        // Small delay before showing to allow page to settle
        const timer = setTimeout(() => {
          setIsVisible(true);
          setIsAnimating(true);
        }, 500);
        return () => clearTimeout(timer);
      }
    } else {
      setIsVisible(false);
      setIsAnimating(false);
    }
  }, [show]);

  const handleDismiss = useCallback(() => {
    setIsAnimating(false);
    // Save to sessionStorage so it doesn't show again this session
    sessionStorage.setItem(SESSION_STORAGE_KEY, "true");
    // Wait for animation to complete before calling onDismiss
    setTimeout(() => {
      setIsVisible(false);
      onDismiss();
    }, 300);
  }, [onDismiss]);

  if (!isVisible) return null;

  return (
    <div
      className={`fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:bottom-6 md:max-w-md z-50 transition-all duration-300 ease-out ${
        isAnimating
          ? "translate-y-0 opacity-100"
          : "translate-y-4 opacity-0"
      }`}
    >
      <div
        className="relative overflow-hidden rounded-xl border border-white/[0.08] bg-slate-900/95 shadow-2xl backdrop-blur-xl"
        style={{
          boxShadow:
            "0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255,255,255,0.05)",
        }}
      >
        {/* Content */}
        <div className="flex items-center gap-4 p-4">
          {/* Icon */}
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-teal-500/20 bg-gradient-to-br from-teal-500/20 to-teal-600/5">
            <LogIn className="h-5 w-5 text-teal-400" />
          </div>

          {/* Message */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-200">
              Sign in to save your reading progress
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Sign in button */}
            <Link
              href="/"
              className="flex items-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-teal-900/20 transition-all hover:bg-teal-500 active:scale-[0.98]"
            >
              Sign in
            </Link>

            {/* Dismiss button */}
            <button
              onClick={handleDismiss}
              className="rounded-full p-2 text-slate-400 transition-colors hover:bg-white/10 hover:text-white group"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4 transition-transform duration-300 group-hover:rotate-90" />
            </button>
          </div>
        </div>

        {/* Decorative Bottom Edge */}
        <div className="h-0.5 w-full bg-gradient-to-r from-teal-500/0 via-teal-500/30 to-teal-500/0" />
      </div>
    </div>
  );
}
