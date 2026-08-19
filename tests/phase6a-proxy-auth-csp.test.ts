import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

import {
  buildContentSecurityPolicy,
  parseSupabaseConnectOrigin,
} from "@/lib/security/browser-policy";
import { updateSupabaseSession } from "@/lib/supabase/proxy";

const baseInput = {
  nonce: "abc123",
  requestUrl: "http://127.0.0.1:3102/saved",
  requestHost: "127.0.0.1:3102",
};

describe("Supabase CSP origin validation", () => {
  it("keeps connect-src self-only when optional Supabase is unconfigured", () => {
    const policy = buildContentSecurityPolicy({
      ...baseInput,
      isDevelopment: true,
    });
    expect(policy).toContain("connect-src 'self' ws://127.0.0.1:3102");
    expect(policy).not.toContain("supabase");
  });

  it("adds exactly one validated local or production origin", () => {
    expect(buildContentSecurityPolicy({
      ...baseInput,
      isDevelopment: true,
      supabaseConnectOrigin: parseSupabaseConnectOrigin("http://127.0.0.1:54321", true),
    })).toContain("connect-src 'self' ws://127.0.0.1:3102 http://127.0.0.1:54321");

    expect(buildContentSecurityPolicy({
      ...baseInput,
      isDevelopment: false,
      supabaseConnectOrigin: parseSupabaseConnectOrigin("https://project.example.supabase.co", false),
    })).toContain("connect-src 'self' https://project.example.supabase.co");
  });

  it("rejects non-HTTPS production origins and non-loopback local HTTP origins", () => {
    expect(() => parseSupabaseConnectOrigin("http://127.0.0.1:54321", false)).toThrow();
    expect(() => parseSupabaseConnectOrigin("http://localhost:54321", false)).toThrow();
    expect(() => parseSupabaseConnectOrigin("http://insecure.example", true)).toThrow();
  });

  it("rejects credential-, path-, query-, fragment-, and injection-shaped values", () => {
    const invalid = [
      "https://user:pass project.example.supabase.co",
      "https://project.example.supabase.co/rest/v1",
      "https://project.example.supabase.co?x=1",
      "https://project.example.supabase.co#fragment",
      " javascript://project.example",
      "https://*.supabase.co",
      "https://project.example.supabase.co; script-src https://evil.example",
      "https://project.example.supabase.co/path\\..\\..",
      "",
    ];
    for (const value of invalid) {
      expect(() => parseSupabaseConnectOrigin(value, false)).toThrow();
    }
  });

  it("never adds Research or AI provider origins", () => {
    const policy = buildContentSecurityPolicy({
      ...baseInput,
      isDevelopment: false,
      supabaseConnectOrigin: parseSupabaseConnectOrigin("https://project.example.supabase.co", false),
    });
    for (const hostname of ["api.tavily.com", "api.search.brave.com", "generativelanguage.googleapis.com", "api.groq.com", "openrouter.ai"]) {
      expect(policy).not.toContain(hostname);
    }
    const connectSource = /connect-src ([^;]+)/.exec(policy)?.[1] ?? "";
    expect(connectSource.split(" ")).toEqual([
      "'self'",
      "https://project.example.supabase.co",
    ]);
    expect(policy).not.toContain("*.supabase.co");
  });
});

describe("Supabase Proxy refresh composition", () => {
  function requestWithPath(path = "/saved"): NextRequest {
    return new NextRequest(new URL(`http://127.0.0.1:3102${path}`), {
      headers: { "x-nonce": "abc123" },
    });
  }

  it("preserves nonce request headers, refreshed cookies, and cache protection together", async () => {
    const nextRequest = requestWithPath();
    const requestHeaders = new Headers(nextRequest.headers);
    requestHeaders.set("Content-Security-Policy", "script-src 'self'");
    const cookiesSeenByAuth: unknown[] = [];

    const response = await updateSupabaseSession(nextRequest, requestHeaders, (cookies) => ({
      auth: {
        getClaims: async () => {
          await cookies.setAll(
            [
              { name: "sb-session", value: "session-value", options: { path: "/", sameSite: "lax" } },
              { name: "sb-refresh", value: "refresh-value", options: { path: "/", sameSite: "lax" } },
            ],
            {
              "Cache-Control": "private, no-store",
              Expires: "0",
              Pragma: "no-cache",
            },
          );
          cookiesSeenByAuth.push(nextRequest.cookies.get("sb-session")?.value);
          return { data: { claims: null }, error: null };
        },
      },
    }));

    expect(requestHeaders.get("x-nonce")).toBe("abc123");
    expect(cookiesSeenByAuth).toEqual(["session-value"]);
    const cookies = response.cookies.getAll();
    expect(cookies.map((cookie) => [cookie.name, cookie.value])).toEqual([
      ["sb-session", "session-value"],
      ["sb-refresh", "refresh-value"],
    ]);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("Expires")).toBe("0");
    expect(response.headers.get("Pragma")).toBe("no-cache");

    response.headers.set("Content-Security-Policy", "script-src 'self'");
    expect(response.cookies.getAll()).toHaveLength(2);
    expect(response.headers.get("Content-Security-Policy")).toBe("script-src 'self'");
  });

  it("keeps every Supabase cookie when setAll is called more than once", async () => {
    const nextRequest = requestWithPath();
    const response = await updateSupabaseSession(nextRequest, new Headers(nextRequest.headers), (cookies) => ({
      auth: {
        getClaims: async () => {
          await cookies.setAll(
            [{ name: "first", value: "one", options: { path: "/" } }],
            { "Cache-Control": "private, no-store" },
          );
          await cookies.setAll(
            [{ name: "second", value: "two", options: { path: "/" } }],
            { "Cache-Control": "private, no-store" },
          );
          return { data: { claims: null }, error: null };
        },
      },
    }));

    expect(response.cookies.getAll().map((cookie) => cookie.name).sort()).toEqual(["first", "second"]);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("does not break anonymous rendering when claims are malformed or invalid", async () => {
    const nextRequest = requestWithPath("/research");
    const response = await updateSupabaseSession(nextRequest, new Headers(nextRequest.headers), () => ({
      auth: {
        getClaims: async () => {
          throw new Error("malformed session");
        },
      },
    }));
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBeNull();
  });

  it("fails cache-safe when an auth-token cookie exists even if getClaims cannot verify it", async () => {
    const nextRequest = new NextRequest(new URL("http://127.0.0.1:3102/saved"), {
      headers: {
        "x-nonce": "abc123",
        cookie: "sb-local-auth-token.0=opaque-test-value",
      },
    });
    const response = await updateSupabaseSession(nextRequest, new Headers(nextRequest.headers), () => ({
      auth: {
        getClaims: async () => {
          throw new Error("local signing mode unsupported by claims verification");
        },
      },
    }));
    expect(response.headers.get("Cache-Control")).toContain("private");
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(response.headers.get("Pragma")).toBe("no-cache");
    expect(response.headers.get("Expires")).toBe("0");
  });

  it("preserves refresh cookies and no-store metadata if claims throws after setAll", async () => {
    const nextRequest = requestWithPath("/saved");
    const response = await updateSupabaseSession(nextRequest, new Headers(nextRequest.headers), (cookies) => ({
      auth: {
        getClaims: async () => {
          await cookies.setAll(
            [{ name: "sb-session", value: "rotated", options: { path: "/", sameSite: "lax" } }],
            { "Cache-Control": "private, no-store", Expires: "0" },
          );
          throw new Error("claims verification failed after refresh");
        },
      },
    }));

    expect(response.cookies.get("sb-session")?.value).toBe("rotated");
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(response.headers.get("Expires")).toBe("0");
  });
});
