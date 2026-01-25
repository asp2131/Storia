"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { authClient, signIn, useSession } from "@/lib/auth-client";

// Dynamically import the hero to avoid SSR issues with Three.js
const MorphogenesisHero = dynamic(
  () => import("@/components/MorphogenesisHero"),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-4xl font-serif font-black tracking-tighter text-amber-100 animate-pulse">
          Storia
        </div>
      </div>
    ),
  }
);

export default function Home() {
  const [authOpen, setAuthOpen] = useState(false);
  const [authEmail, setAuthEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [error, setError] = useState("");

  const { data: session } = useSession();
  const currentUser = session?.user;

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authEmail) return;

    setLoading(true);
    setError("");

    const { error } = await authClient.emailOtp.sendVerificationOtp({
      email: authEmail,
      type: "sign-in",
    });

    setLoading(false);

    if (error) {
      setError(error.message || "Failed to send verification code");
    } else {
      setOtpSent(true);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authEmail || !otp) return;

    setLoading(true);
    setError("");

    const { error } = await signIn.emailOtp({
      email: authEmail,
      otp,
    });

    setLoading(false);

    if (error) {
      setError(error.message || "Invalid verification code");
    } else {
      window.location.href = "/library";
    }
  };

  const handleGoogleSignIn = async () => {
    await signIn.social({
      provider: "google",
      callbackURL: "/library",
      fetchOptions: {
        onRequest: () => setLoading(true),
        onResponse: () => setLoading(false),
      },
    });
  };

  const closeModal = () => {
    setAuthOpen(false);
    setAuthEmail("");
    setOtp("");
    setOtpSent(false);
    setError("");
  };

  return (
    <div className="relative bg-[#0a0a0a] text-white selection:bg-amber-200 selection:text-black">
      {/* Auth Modal */}
      {authOpen && (
        <div
          id="auth-modal"
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 px-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div className="w-full max-w-lg rounded-2xl bg-white text-[#111827] shadow-2xl relative">
            <button
              className="absolute top-4 right-4 text-[#6b7280] hover:text-[#111827] transition"
              aria-label="Close"
              onClick={closeModal}
            >
              ✕
            </button>

            <div className="px-8 py-10">
              <div className="flex items-center justify-center mb-6">
                <div className="w-10 h-10 rounded-full bg-[#111827] text-white flex items-center justify-center font-serif font-bold">
                  S
                </div>
              </div>

              {otpSent ? (
                /* OTP Verification Form */
                <div>
                  <h2 className="text-3xl font-serif font-black text-center mb-2">
                    Enter verification code
                  </h2>
                  <p className="text-center text-sm text-[#6b7280] mb-8">
                    We sent a 6-digit code to <strong>{authEmail}</strong>
                  </p>

                  {error && (
                    <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-600 text-sm text-center">
                      {error}
                    </div>
                  )}

                  <form onSubmit={handleVerifyOtp} className="space-y-5">
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Verification code
                      </label>
                      <input
                        type="text"
                        name="otp"
                        required
                        maxLength={6}
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                        className="w-full h-12 rounded-lg border border-[#e5e7eb] px-4 text-center text-2xl tracking-[0.5em] font-mono focus:outline-none focus:ring-2 focus:ring-[#111827]"
                        placeholder="000000"
                        disabled={loading}
                        autoFocus
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={loading || otp.length !== 6}
                      className="w-full h-12 rounded-full bg-[#111827] text-white font-semibold hover:bg-black transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {loading ? (
                        <svg
                          className="animate-spin h-5 w-5"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                            fill="none"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          />
                        </svg>
                      ) : (
                        "Verify & Sign In"
                      )}
                    </button>
                  </form>

                  <button
                    onClick={() => {
                      setOtpSent(false);
                      setOtp("");
                      setError("");
                    }}
                    className="w-full mt-4 text-sm text-[#6b7280] hover:text-[#111827] transition"
                  >
                    Use a different email
                  </button>
                </div>
              ) : (
                /* Email Entry Form */
                <div>
                  <h2 className="text-3xl font-serif font-black text-center mb-2">
                    Log in / Sign up
                  </h2>
                  <p className="text-center text-sm text-[#6b7280] mb-8">
                    Enter your email to receive a verification code.
                  </p>

                  {error && (
                    <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-600 text-sm text-center">
                      {error}
                    </div>
                  )}

                  <form onSubmit={handleSendOtp} className="space-y-5">
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Your email
                      </label>
                      <input
                        type="email"
                        name="email"
                        required
                        value={authEmail}
                        onChange={(e) => setAuthEmail(e.target.value)}
                        className="w-full h-12 rounded-lg border border-[#e5e7eb] px-4 focus:outline-none focus:ring-2 focus:ring-[#111827]"
                        placeholder="Enter your email address"
                        disabled={loading}
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full h-12 rounded-full bg-[#111827] text-white font-semibold hover:bg-black transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {loading ? (
                        <svg
                          className="animate-spin h-5 w-5"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                            fill="none"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          />
                        </svg>
                      ) : (
                        "Send Verification Code"
                      )}
                    </button>
                  </form>

                  {/* Divider */}
                  <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-[#e5e7eb]" />
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="px-2 bg-white text-[#6b7280]">
                        or continue with
                      </span>
                    </div>
                  </div>

                  {/* Google Sign In */}
                  <button
                    onClick={handleGoogleSignIn}
                    disabled={loading}
                    className="w-full h-12 rounded-full border border-[#e5e7eb] text-[#111827] font-medium hover:bg-[#f9fafb] transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="18"
                      height="18"
                      viewBox="0 0 256 262"
                    >
                      <path
                        fill="#4285F4"
                        d="M255.878 133.451c0-10.734-.871-18.567-2.756-26.69H130.55v48.448h71.947c-1.45 12.04-9.283 30.172-26.69 42.356l-.244 1.622l38.755 30.023l2.685.268c24.659-22.774 38.875-56.282 38.875-96.027"
                      />
                      <path
                        fill="#34A853"
                        d="M130.55 261.1c35.248 0 64.839-11.605 86.453-31.622l-41.196-31.913c-11.024 7.688-25.82 13.055-45.257 13.055c-34.523 0-63.824-22.773-74.269-54.25l-1.531.13l-40.298 31.187l-.527 1.465C35.393 231.798 79.49 261.1 130.55 261.1"
                      />
                      <path
                        fill="#FBBC05"
                        d="M56.281 156.37c-2.756-8.123-4.351-16.827-4.351-25.82c0-8.994 1.595-17.697 4.206-25.82l-.073-1.73L15.26 71.312l-1.335.635C5.077 89.644 0 109.517 0 130.55s5.077 40.905 13.925 58.602z"
                      />
                      <path
                        fill="#EB4335"
                        d="M130.55 50.479c24.514 0 41.05 10.589 50.479 19.438l36.844-35.974C195.245 12.91 165.798 0 130.55 0C79.49 0 35.393 29.301 13.925 71.947l42.211 32.783c10.59-31.477 39.891-54.251 74.414-54.251"
                      />
                    </svg>
                    Sign in with Google
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Fixed Header */}
      <header className="fixed top-0 left-0 right-0 px-4 py-4 md:p-8 flex justify-between items-center mix-blend-difference z-50">
        <div className="flex items-center gap-2">
          <span className="text-2xl font-serif font-black tracking-tighter">
            Storia
          </span>
        </div>
        <nav className="flex gap-8 text-sm font-mono tracking-widest uppercase opacity-70">
          {currentUser ? (
            <a
              href="/library"
              className="hover:opacity-100 transition-opacity cursor-pointer"
            >
              Go to Library
            </a>
          ) : (
            <button
              className="hover:opacity-100 transition-opacity cursor-pointer"
              onClick={() => setAuthOpen(true)}
            >
              Login / Register
            </button>
          )}
        </nav>
      </header>

      {/* Main Content */}
      <MorphogenesisHero
        onAuthClick={() => setAuthOpen(true)}
        isLoggedIn={!!currentUser}
      />
    </div>
  );
}
