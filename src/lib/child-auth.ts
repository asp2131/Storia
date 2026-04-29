// Env contract: requires SUPABASE_SERVICE_ROLE_KEY (server-only) and SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL).
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

let supabaseAdmin: SupabaseClient | null = null;
function getSupabaseAdmin(): SupabaseClient {
  if (supabaseAdmin) return supabaseAdmin;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY for Supabase auth verification"
    );
  }
  supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return supabaseAdmin;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

function unauthorized(reason?: string) {
  if (reason) console.warn(`[child-auth] unauthorized: ${reason}`);
  return NextResponse.json(
    { error: { code: "unauthorized", message: "Authentication required" } },
    { status: 401 }
  );
}

function extractAuthorizationBearer(raw: string | null): string | null {
  if (!raw) return null;
  const match = /^bearer\s+(.+)$/i.exec(raw.trim());
  if (!match) return null;
  const token = match[1].trim();
  return token || null;
}

function extractRawToken(raw: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  return trimmed || null;
}

export async function getAuthenticatedUser(): Promise<
  { user: AuthenticatedUser } | { error: NextResponse }
> {
  const hdrs = await headers();
  // Authorization header MUST use the Bearer scheme; non-Bearer values (e.g. Basic ...) fall through to
  // the x-supabase-access-token header and finally to the Better Auth cookie path — never short-circuit.
  const token =
    extractAuthorizationBearer(hdrs.get("authorization")) ??
    extractRawToken(hdrs.get("x-supabase-access-token"));

  if (token) return resolveBySupabaseToken(token);
  return resolveByBetterAuthSession(hdrs);
}

async function resolveBySupabaseToken(
  token: string
): Promise<{ user: AuthenticatedUser } | { error: NextResponse }> {
  // Long-term: replace email-based linking with explicit provider/account mapping. See specs/auth-provider-account-mapping-followup.md.
  let supaUser: Awaited<
    ReturnType<SupabaseClient["auth"]["getUser"]>
  >["data"]["user"];
  try {
    const { data, error } = await getSupabaseAdmin().auth.getUser(token);
    if (error || !data?.user) {
      return { error: unauthorized(error?.message ?? "no user for token") };
    }
    supaUser = data.user;
  } catch (err) {
    console.error("[child-auth] Supabase getUser threw:", err);
    return { error: unauthorized("supabase verification error") };
  }

  if (!supaUser.email || !supaUser.email_confirmed_at) {
    return { error: unauthorized("unverified Supabase email") };
  }

  const email = supaUser.email;
  const metadata = (supaUser.user_metadata ?? {}) as Record<string, unknown>;
  const name =
    (typeof metadata.full_name === "string" && metadata.full_name) ||
    (typeof metadata.name === "string" && metadata.name) ||
    email.split("@")[0];
  const emailVerified = true;

  try {
    const dbUser = await resolveUser({
      supabaseId: supaUser.id,
      email,
      name,
      emailVerified,
    });

    return {
      user: {
        id: dbUser.id,
        email: dbUser.email,
        name: dbUser.name,
        role: dbUser.role,
      },
    };
  } catch (err) {
    console.error("[child-auth] user resolve failed:", err);
    return { error: unauthorized("user resolve failed") };
  }
}

async function resolveByBetterAuthSession(
  hdrs: Awaited<ReturnType<typeof headers>>
): Promise<{ user: AuthenticatedUser } | { error: NextResponse }> {
  let session: Awaited<ReturnType<typeof auth.api.getSession>>;
  try {
    session = await auth.api.getSession({ headers: hdrs });
  } catch (err) {
    console.error("[child-auth] better-auth getSession threw:", err);
    return { error: unauthorized("better-auth session error") };
  }

  if (!session?.user?.id) {
    return { error: unauthorized("missing bearer token and no session") };
  }

  const dbUser = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!dbUser) {
    return { error: unauthorized("session user not in database") };
  }

  return {
    user: {
      id: dbUser.id,
      email: dbUser.email,
      name: dbUser.name,
      role: dbUser.role,
    },
  };
}

async function resolveUser(params: {
  supabaseId: string;
  email: string;
  name: string;
  emailVerified: boolean;
}) {
  const { supabaseId, email, name, emailVerified } = params;

  const byId = await prisma.user.findUnique({ where: { id: supabaseId } });
  if (byId) {
    return prisma.user.update({
      where: { id: byId.id },
      data: { email, emailVerified },
    });
  }

  // Email linking is only reachable when Supabase reports email_confirmed_at — see resolveBySupabaseToken.
  const byEmail = await prisma.user.findUnique({ where: { email } });
  if (byEmail) {
    return prisma.user.update({
      where: { id: byEmail.id },
      data: { emailVerified },
    });
  }

  try {
    return await prisma.user.create({
      data: {
        id: supabaseId,
        email,
        name,
        emailVerified,
        role: "user",
      },
    });
  } catch (err: unknown) {
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code?: string }).code === "P2002"
    ) {
      const racing = await prisma.user.findUnique({ where: { email } });
      if (racing) return racing;
    }
    throw err;
  }
}

export async function validateChildAccess(childProfileId: string) {
  const result = await getAuthenticatedUser();
  if ("error" in result) return result;

  const childProfile = await prisma.child_profile.findFirst({
    where: { id: childProfileId, userId: result.user.id },
  });

  if (!childProfile) {
    return {
      error: NextResponse.json(
        { error: { code: "forbidden", message: "You do not have access to this child profile" } },
        { status: 403 }
      ),
    };
  }

  return { user: result.user, childProfile };
}
