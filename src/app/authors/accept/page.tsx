"use client";

export const dynamic = "force-dynamic";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient, signIn, useSession } from "@/lib/auth-client";

type InviteInfo = { email: string; state: string };

function AcceptInviteInner() {
  const router = useRouter();
  const token = useSearchParams().get("token") ?? "";
  const { data: session, isPending } = useSession();

  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [accepted, setAccepted] = useState(false);

  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    fetch(`/api/authors/accept?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) setLoadError(data.error ?? "This invitation isn't valid.");
        else setInvite(data);
      })
      .catch(() => !cancelled && setLoadError("Could not load this invitation."));
    return () => {
      cancelled = true;
    };
  }, [token]);

  const accept = useCallback(async () => {
    setBusy(true);
    setError("");
    const res = await fetch("/api/authors/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Could not accept this invitation.");
      return;
    }
    setAccepted(true);
    // The session's role is stale until it's re-read from the database.
    await authClient.getSession({ query: { disableCookieCache: true } });
    router.replace("/admin");
  }, [token, router]);

  const sendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invite) return;
    setBusy(true);
    setError("");
    const { error } = await authClient.emailOtp.sendVerificationOtp({
      email: invite.email,
      type: "sign-in",
    });
    setBusy(false);
    if (error) setError(error.message || "Failed to send the code.");
    else setOtpSent(true);
  };

  const verifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invite) return;
    setBusy(true);
    setError("");
    const { error } = await signIn.emailOtp({ email: invite.email, otp });
    setBusy(false);
    if (error) {
      setError(error.message || "That code didn't work.");
      return;
    }
    await accept();
  };

  const problem = !token
    ? "This link is missing its invitation token."
    : loadError;

  if (problem) {
    return <Shell title="Invitation unavailable">
      <p className="text-center text-sm text-[var(--studio-ink-muted)]">{problem}</p>
    </Shell>;
  }

  if (!invite || isPending) {
    return <Shell title="Loading…">
      <div className="flex justify-center">
        <div className="animate-spin w-6 h-6 border-2 border-[var(--studio-ink-muted)] border-t-transparent rounded-full" />
      </div>
    </Shell>;
  }

  if (invite.state !== "pending") {
    const message =
      invite.state === "accepted"
        ? "This invitation has already been used. Sign in to reach your studio."
        : `This invitation has ${invite.state === "expired" ? "expired" : "been revoked"}. Ask your Loratone contact for a new one.`;
    return <Shell title="Invitation closed">
      <p className="text-center text-sm text-[var(--studio-ink-muted)] mb-6">{message}</p>
      {invite.state === "accepted" && (
        <a href="/admin/login" className="block w-full h-12 leading-[3rem] text-center rounded-full bg-[var(--studio-coral)] text-[var(--studio-on-coral)] font-semibold">
          Go to sign in
        </a>
      )}
    </Shell>;
  }

  const signedInEmail = session?.user?.email as string | undefined;
  const wrongAccount =
    signedInEmail && signedInEmail.toLowerCase() !== invite.email.toLowerCase();

  return (
    <Shell title="Publish on Loratone">
      <p className="text-center text-sm text-[var(--studio-ink-muted)] mb-8">
        You&apos;ve been invited to add your books to the library as{" "}
        <strong className="text-[var(--studio-ink)]">{invite.email}</strong>.
      </p>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-[var(--studio-changes-fill)] border border-[var(--studio-changes-ink)]/30 text-[var(--studio-changes-ink)] text-sm text-center">
          {error}
        </div>
      )}

      {accepted ? (
        <p className="text-center text-sm text-[var(--studio-live-ink)]">
          You&apos;re in — taking you to your studio…
        </p>
      ) : wrongAccount ? (
        <>
          <p className="text-center text-sm text-[var(--studio-ink-muted)] mb-5">
            You&apos;re signed in as <strong className="text-[var(--studio-ink)]">{signedInEmail}</strong>.
            This invitation only works for {invite.email}.
          </p>
          <button
            onClick={async () => {
              await authClient.signOut();
              router.refresh();
            }}
            className="w-full h-12 rounded-full bg-[var(--studio-coral)] text-[var(--studio-on-coral)] font-semibold hover:bg-[var(--studio-coral)]/90 transition"
          >
            Sign out and switch accounts
          </button>
        </>
      ) : signedInEmail ? (
        <button
          onClick={accept}
          disabled={busy}
          className="w-full h-12 rounded-full bg-[var(--studio-coral)] text-[var(--studio-on-coral)] font-semibold hover:bg-[var(--studio-coral)]/90 transition disabled:opacity-50"
        >
          {busy ? "Accepting…" : "Accept invitation"}
        </button>
      ) : otpSent ? (
        <form onSubmit={verifyOtp} className="space-y-5">
          <p className="text-center text-sm text-[var(--studio-ink-muted)]">
            We sent a 6-digit code to <strong className="text-[var(--studio-ink)]">{invite.email}</strong>
          </p>
          <input
            type="text"
            required
            maxLength={6}
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
            className="w-full h-12 rounded-lg bg-[var(--studio-rail)] border border-[var(--studio-rule)] text-[var(--studio-ink)] px-4 text-center text-2xl tracking-[0.5em] font-mono focus:outline-none focus:ring-2 focus:ring-[var(--studio-coral)]"
            placeholder="000000"
            disabled={busy}
            autoFocus
          />
          <button
            type="submit"
            disabled={busy || otp.length !== 6}
            className="w-full h-12 rounded-full bg-[var(--studio-coral)] text-[var(--studio-on-coral)] font-semibold hover:bg-[var(--studio-coral)]/90 transition disabled:opacity-50"
          >
            {busy ? "Verifying…" : "Verify & accept"}
          </button>
        </form>
      ) : (
        <>
          <form onSubmit={sendOtp}>
            <button
              type="submit"
              disabled={busy}
              className="w-full h-12 rounded-full bg-[var(--studio-coral)] text-[var(--studio-on-coral)] font-semibold hover:bg-[var(--studio-coral)]/90 transition disabled:opacity-50"
            >
              {busy ? "Sending…" : `Email a sign-in code to ${invite.email}`}
            </button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[var(--studio-rule)]" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-[var(--studio-card)] text-[var(--studio-ink-muted)]">or</span>
            </div>
          </div>

          <button
            onClick={() =>
              signIn.social({
                provider: "google",
                // Back to this same link so the invite is redeemed after OAuth.
                callbackURL: `/authors/accept?token=${encodeURIComponent(token)}`,
              })
            }
            className="w-full h-12 rounded-full border border-[var(--studio-rule-strong)] bg-[var(--studio-card)] text-[var(--studio-ink)] font-semibold hover:bg-[var(--studio-rail)] transition"
          >
            Continue with Google
          </button>
        </>
      )}
    </Shell>
  );
}

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--studio-rail)] flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl bg-[var(--studio-card)] border border-[var(--studio-rule)] shadow-2xl">
        <div className="px-8 py-10">
          <div className="flex items-center justify-center mb-6">
            <div className="w-10 h-10 rounded-full bg-[var(--studio-coral)] text-[var(--studio-on-coral)] flex items-center justify-center font-serif font-bold">
              S
            </div>
          </div>
          <h1 className="text-2xl font-serif font-black text-center text-[var(--studio-ink)] mb-6">
            {title}
          </h1>
          {children}
        </div>
      </div>
    </div>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={null}>
      <AcceptInviteInner />
    </Suspense>
  );
}
