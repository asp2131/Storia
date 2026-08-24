"use client";

export const dynamic = "force-dynamic";

import { useCallback, useEffect, useState } from "react";

type Invite = {
  id: string;
  email: string;
  note: string | null;
  state: "pending" | "accepted" | "revoked" | "expired";
  expiresAt: string;
  acceptedAt: string | null;
  createdAt: string;
};

type Author = {
  id: string;
  name: string;
  email: string;
  joinedAt: string;
  books: { draft: number; submitted: number; approved: number; rejected: number };
};

const stateStyles: Record<Invite["state"], string> = {
  pending: "bg-amber-500/10 text-[var(--studio-review-ink)]",
  accepted: "bg-emerald-500/10 text-[var(--studio-live-ink)]",
  revoked: "bg-[var(--studio-draft-fill)] text-[var(--studio-draft-ink)]",
  expired: "bg-rose-500/10 text-[var(--studio-changes-ink)]",
};

export default function AdminAuthorsPage() {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [authors, setAuthors] = useState<Author[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [lastLink, setLastLink] = useState<{ url: string; emailSent: boolean } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [invitesRes, authorsRes] = await Promise.all([
        fetch("/api/admin/authors/invites"),
        fetch("/api/admin/authors"),
      ]);
      if (!invitesRes.ok || !authorsRes.ok) throw new Error("Failed to load");
      setInvites((await invitesRes.json()).invites);
      setAuthors((await authorsRes.json()).authors);
      setError("");
    } catch {
      setError("Could not load authors.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const sendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setError("");
    setLastLink(null);
    const res = await fetch("/api/admin/authors/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, note: note || undefined }),
    });
    const data = await res.json();
    setSending(false);
    if (!res.ok) {
      setError(data.error ?? "Could not send the invitation.");
      return;
    }
    setEmail("");
    setNote("");
    setLastLink({ url: data.url, emailSent: data.emailSent });
    load();
  };

  const revokeInvite = async (id: string) => {
    await fetch(`/api/admin/authors/invites/${id}`, { method: "DELETE" });
    load();
  };

  const revokeAuthor = async (id: string) => {
    await fetch(`/api/admin/authors/${id}`, { method: "DELETE" });
    load();
  };

  return (
    <div className="max-w-5xl">
      <div className="flex flex-col gap-[7px] border-b-2 border-[var(--studio-ink)] pb-[18px] mb-6">
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--studio-ink-muted)]">Invite only</span>
        <h1 className="m-0 font-serif text-[44px] font-medium leading-none tracking-[-0.025em]">Authors</h1>
      </div>
      <p className="text-sm leading-relaxed text-[var(--studio-ink-2)] mb-8 max-w-[640px]">
        Author access is invite-only. An invited address can sign in, build books,
        and submit them for review — it can never publish to the library directly.
      </p>

      {error && (
        <div className="mb-6 p-3 rounded-lg bg-[var(--studio-changes-fill)] border border-[var(--studio-changes-ink)]/30 text-[var(--studio-changes-ink)] text-sm">
          {error}
        </div>
      )}

      <form
        onSubmit={sendInvite}
        className="mb-10 p-6 rounded-lg bg-[var(--studio-card)] border border-[var(--studio-rule)] border-l-[3px] border-l-[var(--studio-coral)] space-y-4"
      >
        <h2 className="m-0 font-serif text-xl font-medium">Invite an author</h2>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="author@example.com"
            disabled={sending}
            className="flex-1 h-11 rounded-lg bg-[var(--studio-paper)] border border-[var(--studio-rule)] text-[var(--studio-ink)] px-4 focus:outline-none focus:ring-2 focus:ring-[var(--studio-coral)]"
          />
          <button
            type="submit"
            disabled={sending}
            className="h-11 px-6 rounded-md bg-[var(--studio-coral)] text-[var(--studio-on-coral)] text-[11px] font-bold uppercase tracking-[0.12em] hover:brightness-95 transition disabled:opacity-50"
          >
            {sending ? "Sending…" : "Send invite"}
          </button>
        </div>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Optional note included in the email"
          disabled={sending}
          className="w-full h-11 rounded-lg bg-[var(--studio-paper)] border border-[var(--studio-rule)] text-[var(--studio-ink)] px-4 focus:outline-none focus:ring-2 focus:ring-[var(--studio-coral)]"
        />
        {lastLink && (
          <div className="p-3 rounded-lg bg-[var(--studio-paper)] border border-[var(--studio-rule)] text-sm">
            <p className={lastLink.emailSent ? "text-[var(--studio-live-ink)]" : "text-[var(--studio-review-ink)]"}>
              {lastLink.emailSent
                ? "Invitation emailed. Share this link if it doesn't arrive:"
                : "Email delivery failed — send this link manually:"}
            </p>
            <code className="block mt-2 text-[var(--studio-ink-muted)] break-all">{lastLink.url}</code>
          </div>
        )}
      </form>

      <section className="mb-10">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.13em] text-[var(--studio-ink)] border-b border-[var(--studio-rule)] pb-2.5 mb-4">Invitations</h2>
        {loading ? (
          <p className="text-sm text-[var(--studio-ink-muted)]">Loading…</p>
        ) : invites.length === 0 ? (
          <p className="text-sm text-[var(--studio-ink-muted)]">No invitations yet.</p>
        ) : (
          <ul className="divide-y divide-[var(--studio-rule)] rounded-xl border border-[var(--studio-rule)] overflow-hidden">
            {invites.map((invite) => (
              <li
                key={invite.id}
                className="flex items-center justify-between gap-4 px-4 py-3 bg-[var(--studio-card)]"
              >
                <div className="min-w-0">
                  <p className="text-[var(--studio-ink)] text-sm truncate">{invite.email}</p>
                  <p className="text-xs text-[var(--studio-ink-muted)]">
                    {invite.state === "pending"
                      ? `Expires ${new Date(invite.expiresAt).toLocaleDateString()}`
                      : invite.state === "accepted" && invite.acceptedAt
                        ? `Accepted ${new Date(invite.acceptedAt).toLocaleDateString()}`
                        : `Sent ${new Date(invite.createdAt).toLocaleDateString()}`}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className={`text-[10px] font-bold uppercase tracking-[0.1em] px-2.5 py-1 rounded ${stateStyles[invite.state]}`}>
                    {invite.state}
                  </span>
                  {invite.state === "pending" && (
                    <button
                      onClick={() => revokeInvite(invite.id)}
                      className="text-xs text-[var(--studio-ink-muted)] hover:text-[var(--studio-changes-ink)] transition"
                    >
                      Revoke
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-[11px] font-bold uppercase tracking-[0.13em] text-[var(--studio-ink)] border-b border-[var(--studio-rule)] pb-2.5 mb-4">Active authors</h2>
        {loading ? (
          <p className="text-sm text-[var(--studio-ink-muted)]">Loading…</p>
        ) : authors.length === 0 ? (
          <p className="text-sm text-[var(--studio-ink-muted)]">No authors have accepted yet.</p>
        ) : (
          <ul className="divide-y divide-[var(--studio-rule)] rounded-xl border border-[var(--studio-rule)] overflow-hidden">
            {authors.map((author) => (
              <li
                key={author.id}
                className="flex items-center justify-between gap-4 px-4 py-3 bg-[var(--studio-card)]"
              >
                <div className="min-w-0">
                  <p className="text-[var(--studio-ink)] text-sm truncate">{author.name || author.email}</p>
                  <p className="text-xs text-[var(--studio-ink-muted)] truncate">{author.email}</p>
                </div>
                <div className="flex items-center gap-4 shrink-0 text-xs text-[var(--studio-ink-muted)]">
                  <span>{author.books.approved} live</span>
                  <span className={author.books.submitted > 0 ? "text-[var(--studio-review-ink)]" : ""}>
                    {author.books.submitted} in review
                  </span>
                  <span>{author.books.draft} draft</span>
                  <button
                    onClick={() => revokeAuthor(author.id)}
                    className="text-[var(--studio-ink-muted)] hover:text-[var(--studio-changes-ink)] transition"
                  >
                    Revoke access
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
