import { describe, expect, it } from "vitest";

import {
  buildContentSecurityPolicy,
  staticSecurityHeaders,
} from "@/lib/security/browser-policy";

function directive(policy: string, name: string): string {
  return policy.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name} `)) ?? "";
}

describe("Phase 4 browser security policy", () => {
  it("builds a strict production nonce CSP without unsafe script execution", () => {
    const policy = buildContentSecurityPolicy({
      nonce: "nonce-test-value",
      isDevelopment: false,
      requestUrl: "https://uniproof.example/compare?ignored=https://evil.example/#fragment",
    });

    expect(policy).not.toMatch(/[\r\n]/);
    expect(directive(policy, "script-src")).toContain("'nonce-nonce-test-value'");
    expect(directive(policy, "script-src")).toContain("'strict-dynamic'");
    expect(directive(policy, "script-src")).not.toContain("'unsafe-inline'");
    expect(directive(policy, "script-src")).not.toContain("'unsafe-eval'");
    expect(directive(policy, "style-src-elem")).not.toContain("'unsafe-inline'");
    expect(directive(policy, "script-src-attr")).toBe("script-src-attr 'none'");
    expect(directive(policy, "connect-src")).toBe("connect-src 'self'");
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("base-uri 'none'");
    expect(policy).toContain("form-action 'self'");
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).not.toContain("evil.example");
  });

  it("adds only the same-host websocket and unsafe-eval development compatibility sources", () => {
    const policy = buildContentSecurityPolicy({
      nonce: "dev-nonce",
      isDevelopment: true,
      requestUrl: "http://localhost:3102/compare?next=wss://evil.example/socket",
      requestHost: "127.0.0.1:3102",
    });

    expect(directive(policy, "script-src")).toContain("'unsafe-eval'");
    expect(directive(policy, "script-src")).not.toContain("'unsafe-inline'");
    expect(directive(policy, "style-src-elem")).toBe("style-src-elem 'self' 'unsafe-inline'");
    expect(directive(policy, "style-src-elem")).not.toContain("nonce-dev-nonce");
    expect(directive(policy, "connect-src")).toContain("ws://127.0.0.1:3102");
    expect(policy).not.toContain("evil.example");
    expect(policy).not.toMatch(/[\r\n]/);
  });

  it("fails closed when a malformed development request URL cannot yield a websocket source", () => {
    const policy = buildContentSecurityPolicy({
      nonce: "safe-nonce",
      isDevelopment: true,
      requestUrl: "not a valid URL\r\nconnect-src https://evil.example",
    });

    expect(directive(policy, "connect-src")).toBe("connect-src 'self'");
    expect(policy).not.toContain("evil.example");
    expect(policy).not.toMatch(/[\r\n]/);
  });

  it("publishes the exact static defense-in-depth headers and intentionally omits HSTS", () => {
    expect(Object.fromEntries(staticSecurityHeaders.map(({ key, value }) => [key, value]))).toEqual({
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "X-Frame-Options": "DENY",
      "X-DNS-Prefetch-Control": "off",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Resource-Policy": "same-origin",
    });
    expect(staticSecurityHeaders.some(({ key }) => key.toLowerCase() === "strict-transport-security")).toBe(false);
  });
});
