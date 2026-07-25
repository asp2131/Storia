// Create client instance using type assertion to bypass TypeScript issues
// @ts-ignore
import { createAuthClient } from "better-auth/react";

// Create client with fallback for build time
let authClientInstance: any = null;

try {
  authClientInstance = createAuthClient({
    // ponytail: same-origin in the browser — the auth routes are served by this
    // same Next app, so hardcoding a host only breaks when the domain changes.
    // NEXT_PUBLIC_APP_URL is the SSR/build-time fallback where there's no window.
    baseURL:
      typeof window !== "undefined"
        ? window.location.origin
        : process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  });
} catch (error) {
  // During build time, create a mock client
  authClientInstance = {
    signIn: () => Promise.resolve(),
    signOut: () => Promise.resolve(),
    signUp: () => Promise.resolve(),
    useSession: () => ({ data: null, isPending: false, error: null }),
  };
}

export const authClient = authClientInstance;

// @ts-ignore
export const { signIn, signOut, signUp, useSession } = authClient;
