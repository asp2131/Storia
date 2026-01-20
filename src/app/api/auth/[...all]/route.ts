import { toNextJsHandler } from "better-auth/next-js";
import { getAuth } from "@/lib/auth";

export const GET = async (request: Request) => {
  const auth = getAuth();
  const handler = toNextJsHandler(auth);
  return handler.GET(request);
};

export const POST = async (request: Request) => {
  const auth = getAuth();
  const handler = toNextJsHandler(auth);
  return handler.POST(request);
};
