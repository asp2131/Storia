import { toNextJsHandler } from "better-auth/next-js";
import { getAuth } from "@/lib/auth";

export const GET = async (request: Request) => {
  const auth = getAuth();
  const handler = toNextJsHandler(auth);
  return handler.GET(request);
};

export const POST = async (request: Request) => {
  try {
    const auth = getAuth();
    const handler = toNextJsHandler(auth);
    return await handler.POST(request);
  } catch (err: unknown) {
    console.error("[DEBUG AUTH POST] Full error:", err);
    if (err instanceof AggregateError) {
      console.error("[DEBUG AUTH POST] AggregateError errors:", err.errors);
      for (const e of err.errors) {
        console.error("[DEBUG AUTH POST] Sub-error:", e, "address:", (e as any).address, "port:", (e as any).port);
      }
    }
    throw err;
  }
};
