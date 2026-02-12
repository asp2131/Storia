import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface AdminAuthResult {
  user: AdminUser;
}

/**
 * Verify the current request is from an authenticated admin.
 *
 * Usage in a route handler:
 *   const authResult = await requireAdmin();
 *   if (authResult instanceof NextResponse) return authResult;
 *   const { user } = authResult;
 *
 * Uses Better Auth (NOT NextAuth). Reads session from cookies
 * via the Better Auth `api.getSession()` method.
 */
export async function requireAdmin(): Promise<AdminAuthResult | NextResponse> {
  try {
    const auth = getAuth();
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 }
      );
    }

    // Better Auth's additionalFields (role) are present at runtime
    // but not reflected in the default session type.
    const user = session.user as typeof session.user & { role?: string };

    if (user.role !== "admin") {
      return NextResponse.json(
        { error: "Admin access required." },
        { status: 403 }
      );
    }

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  } catch (error) {
    console.error("[admin-auth] Session verification failed:", error);
    return NextResponse.json(
      { error: "Authentication failed." },
      { status: 401 }
    );
  }
}
