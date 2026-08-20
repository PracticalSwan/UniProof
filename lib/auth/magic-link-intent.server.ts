import "server-only";

import { randomUUID, timingSafeEqual } from "node:crypto";

import { authMagicLinkIntentResponseSchema } from "./contracts";

export const AUTH_MAGIC_LINK_INTENT_COOKIE = "uniproof-auth-intent";
export const AUTH_MAGIC_LINK_INTENT_MAX_AGE_SECONDS = 10 * 60;

export function createMagicLinkIntentState(): string {
  return authMagicLinkIntentResponseSchema.parse({
    state: randomUUID().replaceAll("-", ""),
  }).state;
}

export function magicLinkIntentCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/auth/confirm",
    maxAge: AUTH_MAGIC_LINK_INTENT_MAX_AGE_SECONDS,
  };
}

export function matchesMagicLinkIntent(expected: string | undefined, supplied: string | null): boolean {
  const expectedState = authMagicLinkIntentResponseSchema.shape.state.safeParse(expected);
  const suppliedState = authMagicLinkIntentResponseSchema.shape.state.safeParse(supplied);
  if (!expectedState.success || !suppliedState.success) return false;
  return timingSafeEqual(Buffer.from(expectedState.data), Buffer.from(suppliedState.data));
}
