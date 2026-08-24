"use client";

export const dynamic = "force-dynamic";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient, signIn, useSession } from "@/lib/auth-client";

const STUDIO_ROLES = ["admin", "author"];

function AdminLoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, isPending } = useSession();

  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const initialError = searchParams.get("error");
  useEffect(() => {
    if (initialError === "forbidden") {
      setError("This account doesn't have studio access.");
    }
  }, [initialError]);

  useEffect(() => {
    if (isPending) return;
    if (
      session?.user &&
      STUDIO_ROLES.includes((session.user as { role?: string }).role ?? "user")
    ) {
      router.replace("/admin");
    }
  }, [session, isPending, router]);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    setError("");
    const { error } = await authClient.emailOtp.sendVerificationOtp({
      email,
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
    if (!email || !otp) return;
    setLoading(true);
    setError("");

    const { error } = await signIn.emailOtp({ email, otp });
    if (error) {
      setLoading(false);
      setError(error.message || "Invalid verification code");
      return;
    }

    const fresh = await authClient.getSession();
    const role = (fresh?.data?.user as { role?: string } | undefined)?.role;
    setLoading(false);

    if (STUDIO_ROLES.includes(role ?? "user")) {
      router.replace("/admin");
    } else {
      await authClient.signOut();
      setError(
        "This account doesn't have studio access. Authors need an invitation."
      );
      setOtpSent(false);
      setOtp("");
    }
  };

  const handleGoogleSignIn = async () => {
    await signIn.social({
      provider: "google",
      callbackURL: "/admin",
      errorCallbackURL: "/admin/login?error=oauth",
      fetchOptions: {
        onRequest: () => setLoading(true),
        onResponse: () => setLoading(false),
      },
    });
  };

  return (
    <div className="min-h-screen bg-[var(--studio-rail)] flex items-center justify-center px-4">
      <div className="w-full max-w-[468px] rounded-[10px] bg-[var(--studio-card)] border border-[var(--studio-rule)] shadow-[0_18px_44px_rgba(33,31,36,0.07)]">
        <div className="p-11">
          <div className="flex flex-col items-center gap-[18px] mb-7">
            <div className="w-[52px] h-[52px] rounded-lg bg-[var(--studio-coral-wash)] text-[var(--studio-coral-darker)] flex items-center justify-center font-serif text-2xl font-semibold">
              L
            </div>
            <div className="flex flex-col items-center gap-2.5">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--studio-coral-deep)]">
                Loratone Studio
              </span>
              <h1 className="m-0 font-serif text-3xl font-medium tracking-[-0.02em] text-[var(--studio-ink)]">
                Sign in
              </h1>
              <p className="m-0 text-center text-[13px] leading-relaxed text-[var(--studio-ink-2)]">
                Write, edit, and review books for the library.
              </p>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-[var(--studio-changes-fill)] border border-[var(--studio-changes-ink)]/30 text-[var(--studio-changes-ink)] text-sm text-center">
              {error}
            </div>
          )}

          {otpSent ? (
            <form onSubmit={handleVerifyOtp} className="space-y-5">
              <p className="text-center text-sm text-[var(--studio-ink-muted)]">
                We sent a 6-digit code to <strong className="text-[var(--studio-ink)]">{email}</strong>
              </p>
              <div>
                <label className="block text-sm font-medium mb-2 text-[var(--studio-ink)]">
                  Verification code
                </label>
                <input
                  type="text"
                  name="otp"
                  required
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                  className="w-full h-12 rounded-lg bg-[var(--studio-rail)] border border-[var(--studio-rule)] text-[var(--studio-ink)] px-4 text-center text-2xl tracking-[0.5em] font-mono focus:outline-none focus:ring-2 focus:ring-[var(--studio-coral)]"
                  placeholder="000000"
                  disabled={loading}
                  autoFocus
                />
              </div>
              <button
                type="submit"
                disabled={loading || otp.length !== 6}
                className="w-full h-[50px] rounded-md bg-[var(--studio-coral)] text-[var(--studio-on-coral)] text-[11px] font-bold uppercase tracking-[0.13em] hover:brightness-95 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Verifying…" : "Verify & Sign In"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setOtpSent(false);
                  setOtp("");
                  setError("");
                }}
                className="w-full text-sm text-[var(--studio-ink-muted)] hover:text-white transition"
              >
                Use a different email
              </button>
            </form>
          ) : (
            <>
              <form onSubmit={handleSendOtp} className="space-y-5">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-[0.13em] mb-2.5 text-[var(--studio-ink-2)]">
                    Email
                  </label>
                  <input
                    type="email"
                    name="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full h-12 rounded-lg bg-[var(--studio-rail)] border border-[var(--studio-rule)] text-[var(--studio-ink)] px-4 focus:outline-none focus:ring-2 focus:ring-[var(--studio-coral)]"
                    placeholder="you@example.com"
                    disabled={loading}
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-[50px] rounded-md bg-[var(--studio-coral)] text-[var(--studio-on-coral)] text-[11px] font-bold uppercase tracking-[0.13em] hover:brightness-95 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? "Sending…" : "Send Verification Code"}
                </button>
              </form>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-[var(--studio-rule)]" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-[var(--studio-card)] text-[var(--studio-ink-muted)]">
                    or continue with
                  </span>
                </div>
              </div>

              <button
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="w-full h-[50px] rounded-md border border-[var(--studio-rule-strong)] bg-[var(--studio-card)] text-[var(--studio-ink)] text-[11px] font-bold uppercase tracking-[0.13em] hover:bg-[var(--studio-rail)] transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 256 262">
                  <path fill="#4285F4" d="M255.878 133.451c0-10.734-.871-18.567-2.756-26.69H130.55v48.448h71.947c-1.45 12.04-9.283 30.172-26.69 42.356l-.244 1.622l38.755 30.023l2.685.268c24.659-22.774 38.875-56.282 38.875-96.027" />
                  <path fill="#34A853" d="M130.55 261.1c35.248 0 64.839-11.605 86.453-31.622l-41.196-31.913c-11.024 7.688-25.82 13.055-45.257 13.055c-34.523 0-63.824-22.773-74.269-54.25l-1.531.13l-40.298 31.187l-.527 1.465C35.393 231.798 79.49 261.1 130.55 261.1" />
                  <path fill="#FBBC05" d="M56.281 156.37c-2.756-8.123-4.351-16.827-4.351-25.82c0-8.994 1.595-17.697 4.206-25.82l-.073-1.73L15.26 71.312l-1.335.635C5.077 89.644 0 109.517 0 130.55s5.077 40.905 13.925 58.602z" />
                  <path fill="#EB4335" d="M130.55 50.479c24.514 0 41.05 10.589 50.479 19.438l36.844-35.974C195.245 12.91 165.798 0 130.55 0C79.49 0 35.393 29.301 13.925 71.947l42.211 32.783c10.59-31.477 39.891-54.251 74.414-54.251" />
                </svg>
                Sign in with Google
              </button>

              <p className="mt-7 pt-5 border-t border-[var(--studio-rule)] text-center text-xs leading-relaxed text-[var(--studio-ink-muted)]">
                Author access is by invitation. If you have one, open the link in
                your email instead.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={null}>
      <AdminLoginPageInner />
    </Suspense>
  );
}
