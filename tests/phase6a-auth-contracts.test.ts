import { describe, expect, it } from "vitest";

import {
  authEmailSchema,
  authMagicLinkIntentResponseSchema,
  safeInternalAuthRedirect,
  sanitizeAuthRequestError,
} from "@/lib/auth/contracts";
import {
  createMagicLinkIntentState,
  matchesMagicLinkIntent,
} from "@/lib/auth/magic-link-intent.server";

describe("auth email contract", () => {
  it("trims and accepts a bounded valid email", () => {
    expect(authEmailSchema.parse("  Invented.A@Example.com ")).toBe("Invented.A@Example.com");
  });

  it("rejects blank, malformed, oversized, and Unicode-shaped delimiter input", () => {
    for (const value of ["", " ", "not-an-email", `${"a".repeat(250)}@example.com`, "a@example.com\u0000"]) {
      expect(authEmailSchema.safeParse(value).success).toBe(false);
    }
  });
});

describe("auth redirects", () => {
  it("accepts only exact closed internal destinations", () => {
    expect(safeInternalAuthRedirect("/saved")).toBe("/saved");
    expect(safeInternalAuthRedirect("/research")).toBe("/research");
    expect(safeInternalAuthRedirect("/compare")).toBe("/compare");
    expect(safeInternalAuthRedirect("/guide")).toBe("/guide");
  });

  it("rejects external, protocol-relative, encoded, and traversal-shaped values", () => {
    for (const value of [
      "https://attacker.example",
      "//attacker.example",
      "/\\attacker.example",
      "https://uniProof.openredirect.example",
      "/saved/..%2f..%2f",
      "/auth/confirm?token_hash=secret",
      "",
    ]) {
      expect(safeInternalAuthRedirect(value)).toBeNull();
    }
  });
});

describe("Magic Link browser intent binding", () => {
  it("creates a bounded intent and matches only the exact initiating-browser value", () => {
    const state = createMagicLinkIntentState();
    const differentState = `${state.slice(0, -1)}${state.endsWith("0") ? "1" : "0"}`;
    expect(authMagicLinkIntentResponseSchema.safeParse({ state }).success).toBe(true);
    expect(matchesMagicLinkIntent(state, state)).toBe(true);
    expect(matchesMagicLinkIntent(state, differentState)).toBe(false);
    expect(matchesMagicLinkIntent(undefined, state)).toBe(false);
    expect(matchesMagicLinkIntent(state, null)).toBe(false);
  });
});

describe("auth error sanitization", () => {
  it("returns generic bounded outcomes without provider detail", () => {
    expect(sanitizeAuthRequestError(new Error("raw provider 429 detail"))).toEqual({
      code: "auth-unavailable",
      message: "The sign-in request could not be completed. Try again shortly.",
    });
  });
});
