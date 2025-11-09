"use client";

import { useSession as useNextAuthSession } from "next-auth/react";

/**
 * Custom hook for accessing session data on the client side
 * Wraps NextAuth's useSession hook for easier usage
 */
export function useSession() {
  const { data: session, status } = useNextAuthSession();

  return {
    session,
    user: session?.user,
    isAuthenticated: status === "authenticated",
    isLoading: status === "loading",
    status,
  };
}
