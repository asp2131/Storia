import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function getAuthenticatedUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return {
      error: NextResponse.json(
        { error: { code: "unauthorized", message: "Authentication required" } },
        { status: 401 }
      ),
    };
  }
  return { user: session.user };
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
