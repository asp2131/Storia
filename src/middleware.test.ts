import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

import { middleware } from "./middleware";

function req(origin: string | null, method = "GET") {
  const headers = new Headers();
  if (origin) headers.set("origin", origin);
  return new NextRequest("https://storia.kids/api/child-profiles", {
    method,
    headers,
  });
}

const ACAO = "Access-Control-Allow-Origin";

describe("CORS middleware", () => {
  it("allows the production web app", () => {
    const res = middleware(req("https://app.loratone.com"));
    expect(res.headers.get(ACAO)).toBe("https://app.loratone.com");
  });

  it("allows Pages alias and preview subdomains", () => {
    for (const o of [
      "https://loratone-app.pages.dev",
      "https://f2b8314f.loratone-app.pages.dev",
    ]) {
      expect(middleware(req(o)).headers.get(ACAO)).toBe(o);
    }
  });

  it("allows localhost on any port for web dev", () => {
    const o = "http://localhost:54321";
    expect(middleware(req(o)).headers.get(ACAO)).toBe(o);
  });

  it("answers preflight with 204 and the CORS headers", () => {
    const res = middleware(req("https://app.loratone.com", "OPTIONS"));
    expect(res.status).toBe(204);
    expect(res.headers.get(ACAO)).toBe("https://app.loratone.com");
    expect(res.headers.get("Access-Control-Allow-Headers")).toContain("authorization");
  });

  it("never sets Allow-Credentials (auth is a Bearer header, not a cookie)", () => {
    const res = middleware(req("https://app.loratone.com"));
    expect(res.headers.get("Access-Control-Allow-Credentials")).toBeNull();
  });

  it("rejects look-alike and unrelated origins", () => {
    for (const o of [
      "https://evil.com",
      // suffix attack: must not match app.loratone.com
      "https://app.loratone.com.evil.com",
      // prefix attack on the pages.dev pattern
      "https://loratone-app.pages.dev.evil.com",
      "http://app.loratone.com", // http, not https
    ]) {
      expect(middleware(req(o)).headers.get(ACAO), o).toBeNull();
    }
  });

  it("passes through same-origin requests (no Origin header)", () => {
    expect(middleware(req(null)).headers.get(ACAO)).toBeNull();
  });
});
