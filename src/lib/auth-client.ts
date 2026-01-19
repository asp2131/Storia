// Create client instance using type assertion to bypass TypeScript issues
// @ts-ignore
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL,
});

// @ts-ignore
export const { signIn, signOut, signUp, useSession } = authClient;
