import { toNextJsHandler } from "better-auth/next-js";

// Lazy load auth to avoid build-time initialization
const getAuthHandler = () => {
  const { auth } = require("@/lib/auth");
  return toNextJsHandler(auth);
};

export const GET = async (request: Request) => {
  const handler = getAuthHandler();
  return handler.GET(request);
};

export const POST = async (request: Request) => {
  const handler = getAuthHandler();
  return handler.POST(request);
};
