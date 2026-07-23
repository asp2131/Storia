import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * CORS for the Flutter web client (app.loratone.com).
 *
 * Native mobile clients don't enforce CORS, so these routes never needed it
 * until the web build shipped. Browsers block the request before it's sent
 * unless the preflight comes back with a matching Access-Control-Allow-Origin.
 *
 * Auth is a Bearer token in the `authorization` header, not a cookie, so
 * Access-Control-Allow-Credentials is deliberately NOT set — keeping it off
 * means a leaked origin can't ride on a user's session.
 */
const ALLOWED_ORIGINS = [
  /^https:\/\/app\.loratone\.com$/,
  // Pages production alias + per-deployment preview subdomains
  /^https:\/\/([a-z0-9-]+\.)?loratone-app\.pages\.dev$/,
  // Local web dev: `flutter run -d chrome` picks a random port
  /^http:\/\/localhost:\d+$/,
  /^http:\/\/127\.0\.0\.1:\d+$/,
];

function allowedOrigin(origin: string | null): string | null {
  if (!origin) return null;
  return ALLOWED_ORIGINS.some((re) => re.test(origin)) ? origin : null;
}

function applyCors(res: NextResponse, origin: string): NextResponse {
  res.headers.set("Access-Control-Allow-Origin", origin);
  res.headers.set("Access-Control-Allow-Methods", "GET,POST,PATCH,PUT,DELETE,OPTIONS");
  res.headers.set("Access-Control-Allow-Headers", "authorization,content-type");
  res.headers.set("Access-Control-Max-Age", "86400");
  // Responses differ per origin — without this a shared cache can serve one
  // origin's ACAO header to another and break the client.
  res.headers.append("Vary", "Origin");
  return res;
}

export function middleware(request: NextRequest) {
  const origin = allowedOrigin(request.headers.get("origin"));

  // Unknown or same-origin caller: pass through untouched. Same-origin
  // requests send no Origin header and don't need CORS at all.
  if (!origin) return NextResponse.next();

  if (request.method === "OPTIONS") {
    return applyCors(new NextResponse(null, { status: 204 }), origin);
  }

  return applyCors(NextResponse.next(), origin);
}

export const config = {
  matcher: "/api/:path*",
};
