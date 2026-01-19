"use client";

import { useState } from "react";
import LandingAnimations from "@/components/LandingAnimations";
import { authClient, signIn, useSession } from "@/lib/auth-client";

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
    <div
      id="landing-page-container"
      className="relative overflow-hidden bg-[#0a0a0a] text-white selection:bg-amber-200 selection:text-black"
    >
      <LandingAnimations />

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

      {/* Custom Acoustic Cursor */}
      <div
        id="custom-cursor"
        className="fixed top-0 left-0 w-8 h-8 pointer-events-none z-[9999] mix-blend-difference hidden md:block"
      >
        <div className="absolute inset-0 border border-white rounded-full flex items-center justify-center">
          <div className="cursor-line w-[1px] h-3 bg-white mx-[1px]"></div>
          <div className="cursor-line w-[1px] h-4 bg-white mx-[1px]"></div>
          <div className="cursor-line w-[1px] h-3 bg-white mx-[1px]"></div>
          <div className="cursor-line w-[1px] h-2 bg-white mx-[1px]"></div>
        </div>
      </div>

      {/* Phase A: The Hero Entrance (Load) */}
      <div
        id="hero-entrance"
        className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0a0a0a] pointer-events-none"
      >
        <h1 className="entrance-logo text-4xl font-serif font-black tracking-tighter opacity-0">
          Storia
        </h1>
      </div>

      {/* Background Soundscape Blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="bg-blob bg-blob-1 absolute top-[-10%] left-[-10%] w-[60vw] h-[60vw] rounded-full blur-[100px] opacity-40 bg-indigo-900"></div>
        <div className="bg-blob bg-blob-2 absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] rounded-full blur-[100px] opacity-40 bg-purple-900"></div>
        <div className="bg-blob bg-blob-3 absolute top-[40%] left-[30%] w-[40vw] h-[40vw] rounded-full blur-[100px] opacity-0 bg-amber-900"></div>
      </div>

      <div className="storia-container relative z-10">
        {/* Header */}
        <header className="fixed top-0 left-0 right-0 p-8 flex justify-between items-center mix-blend-difference z-50">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-serif font-black tracking-tighter">
              Storia
            </span>
          </div>
          <nav className="flex gap-8 text-sm font-mono tracking-widest uppercase opacity-70">
            {currentUser ? (
              <a
                href="/library"
                className="hover:opacity-100 transition-opacity cursor-hover"
              >
                Go to Library
              </a>
            ) : (
              <button
                className="hover:opacity-100 transition-opacity cursor-hover"
                onClick={() => setAuthOpen(true)}
              >
                Login / Register
              </button>
            )}
          </nav>
        </header>

        {/* Phase B: The Soundwave Scrub Section */}
        <section className="min-h-screen flex flex-col items-center">
          <div className="h-screen flex flex-col items-center justify-center px-4 text-center max-w-6xl mx-auto overflow-hidden">
            <div className="mb-4 font-mono text-xs tracking-[0.5em] uppercase opacity-40 translate-y-10 reveal-item">
              Experience Literature through Sound
            </div>

            <h1
              id="hero-text"
              className="text-6xl md:text-8xl lg:text-9xl font-serif font-black leading-none mb-12 tracking-tight"
            >
              Books That Sound Amazing
            </h1>

            <p className="max-w-2xl text-lg md:text-xl font-light leading-relaxed opacity-0 translate-y-10 reveal-item selection:bg-amber-200">
              Experience literature like never before with{" "}
              <span className="cursor-hover font-mono italic border-b border-white/30">
                AI-generated soundscapes
              </span>{" "}
              that adapt to every scene, creating an immersive reading journey.
            </p>

            <div className="mt-16 opacity-0 translate-y-10 reveal-item">
              {currentUser ? (
                <a
                  href="/library"
                  className="group relative px-12 py-5 overflow-hidden rounded-full border border-white/20 hover:border-white/50 transition-colors cursor-hover"
                >
                  <span className="relative z-10 font-mono uppercase tracking-widest text-sm">
                    Go to Library
                  </span>
                  <div className="absolute inset-0 bg-white translate-y-full group-hover:translate-y-0 transition-transform duration-500 ease-out"></div>
                  <span className="absolute inset-0 flex items-center justify-center z-20 font-mono uppercase tracking-widest text-sm text-black translate-y-full group-hover:translate-y-0 transition-transform duration-500 ease-out">
                    Go to Library
                  </span>
                </a>
              ) : (
                <button
                  className="group relative px-12 py-5 overflow-hidden rounded-full border border-white/20 hover:border-white/50 transition-colors cursor-hover"
                  onClick={() => setAuthOpen(true)}
                >
                  <span className="relative z-10 font-mono uppercase tracking-widest text-sm">
                    Start the Journey
                  </span>
                  <div className="absolute inset-0 bg-white translate-y-full group-hover:translate-y-0 transition-transform duration-500 ease-out"></div>
                  <span className="absolute inset-0 flex items-center justify-center z-20 font-mono uppercase tracking-widest text-sm text-black translate-y-full group-hover:translate-y-0 transition-transform duration-500 ease-out">
                    Start the Journey
                  </span>
                </button>
              )}
            </div>

            {/* Scroll Indicator */}
            <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex flex-col items-center gap-4 opacity-40">
              <div className="w-[1px] h-12 bg-gradient-to-b from-white to-transparent"></div>
              <span className="font-mono text-[10px] tracking-[0.3em] uppercase">
                Scroll to play
              </span>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="relative min-h-screen py-32 px-8 flex flex-col items-center justify-center">
          <div className="grid md:grid-cols-3 gap-16 max-w-7xl">
            <div className="space-y-6 group">
              <div className="font-mono text-xs opacity-40">01 / Analysis</div>
              <h3 className="text-4xl font-serif italic">AI Scene Analysis</h3>
              <p className="font-light opacity-60 leading-relaxed">
                Our AI identifies scenes, moods, settings, and emotions -
                understanding the context just like a human reader would.
              </p>
            </div>
            <div className="space-y-6 group">
              <div className="font-mono text-xs opacity-40">02 / Generation</div>
              <h3 className="text-4xl font-serif italic">Sonic Immersion</h3>
              <p className="font-light opacity-60 leading-relaxed">
                Enjoy seamlessly generated soundscapes that crossfade between
                scenes, adapting to the story&apos;s mood in real-time.
              </p>
            </div>
            <div className="space-y-6 group">
              <div className="font-mono text-xs opacity-40">03 / Experience</div>
              <h3 className="text-4xl font-serif italic">The Living Text</h3>
              <p className="font-light opacity-60 leading-relaxed">
                Every word resonates with meaning. Experience your library as a
                multi-sensory journey through sound and light.
              </p>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="min-h-screen flex flex-col items-center justify-center text-center px-8 relative overflow-hidden">
          <div className="relative z-10">
            <h2 className="text-5xl md:text-7xl font-serif font-black mb-12">
              Ready to listen?
            </h2>
            {currentUser ? (
              <a
                href="/library"
                className="text-2xl md:text-3xl font-serif italic hover:text-amber-200 transition-colors cursor-hover border-b border-white/20 pb-2"
              >
                Continue your journey in the Library
              </a>
            ) : (
              <button
                className="text-2xl md:text-3xl font-serif italic hover:text-amber-200 transition-colors cursor-hover border-b border-white/20 pb-2"
                onClick={() => setAuthOpen(true)}
              >
                Read your first Storia soundscape-book today
              </button>
            )}
          </div>
        </section>

        {/* Footer */}
        <footer className="p-12 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-8 opacity-40 text-xs font-mono tracking-widest uppercase">
          <div>© 2026 Storia</div>
          <div className="flex gap-8">
            <a href="/admin/books" className="hover:opacity-100 transition-opacity">
              Admin
            </a>
            <a
              href="https://github.com"
              className="hover:opacity-100 transition-opacity"
            >
              GitHub
            </a>
          </div>
        </footer>
      </div>
    </div>
  );
}
