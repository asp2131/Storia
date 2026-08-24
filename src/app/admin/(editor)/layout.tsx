"use client";

export const dynamic = "force-dynamic";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";

const STUDIO_ROLES = ["admin", "author"];

/**
 * The editor sits outside the dashboard chrome, so it needs its own gate.
 * Ownership is still enforced per-request by the API — this only keeps the
 * wrong person from staring at an empty editor.
 */
export default function EditorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { data: session, isPending } = useSession();

  useEffect(() => {
    if (isPending) return;
    if (!session) {
      router.push("/admin/login");
    } else if (!STUDIO_ROLES.includes(session.user.role)) {
      router.push("/admin/login?error=forbidden");
    }
  }, [session, isPending, router]);

  if (isPending || !session || !STUDIO_ROLES.includes(session.user.role)) {
    return (
      <div className="min-h-screen bg-zinc-100 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-zinc-400 border-t-transparent rounded-full" />
      </div>
    );
  }

  return <>{children}</>;
}
