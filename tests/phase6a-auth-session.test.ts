import { describe, expect, it } from "vitest";

import {
  resolveSupabaseIdentity,
  type SupabaseIdentityClient,
} from "@/lib/auth/session";

const validUuid = "11111111-1111-4111-8111-111111111111";

function claimsClient(result: {
  claims?: { sub?: unknown } | null;
  error?: { message?: string } | null;
}): SupabaseIdentityClient {
  return {
    auth: {
      getClaims: async () => ({
        data: { claims: result.claims ?? null },
        error: result.error ?? null,
      }),
      getUser: async () => {
        throw new Error("claims identity must not call getUser");
      },
    },
  };
}

function userClient(result: {
  user?: { id?: unknown } | null;
  error?: { message?: string; status?: number; name?: string } | null;
}): SupabaseIdentityClient {
  return {
    auth: {
      getClaims: async () => {
        throw new Error("private identity must not fall back through claims");
      },
      getUser: async () => ({
        data: { user: result.user ?? null },
        error: result.error ?? null,
      }),
    },
  };
}

describe("Supabase identity assurance", () => {
  it("returns a verified SSR identity from valid UUID claims", async () => {
    await expect(resolveSupabaseIdentity(
      claimsClient({ claims: { sub: validUuid } }),
      "claims",
    )).resolves.toEqual({ status: "authenticated", userId: validUuid });
  });

  it("treats absent, errored, and invalid-sub claims as unauthenticated", async () => {
    await expect(resolveSupabaseIdentity(claimsClient({}), "claims")).resolves.toEqual({ status: "unauthenticated" });
    await expect(resolveSupabaseIdentity(
      claimsClient({ error: { message: "invalid token" } }),
      "claims",
    )).resolves.toEqual({ status: "unauthenticated" });
    await expect(resolveSupabaseIdentity(
      claimsClient({ claims: { sub: "not-a-uuid" } }),
      "claims",
    )).resolves.toEqual({ status: "unauthenticated" });
  });

  it("uses current Auth-server validation for private artifact operations", async () => {
    await expect(resolveSupabaseIdentity(
      userClient({ user: { id: validUuid } }),
      "auth-server",
    )).resolves.toEqual({ status: "authenticated", userId: validUuid });
  });

  it("treats a server-confirmed signed-out, missing-session, or revoked user as unauthenticated", async () => {
    await expect(resolveSupabaseIdentity(userClient({}), "auth-server")).resolves.toEqual({ status: "unauthenticated" });
    await expect(resolveSupabaseIdentity(
      userClient({ error: { status: 400, name: "AuthSessionMissingError", message: "session absent" } }),
      "auth-server",
    )).resolves.toEqual({ status: "unauthenticated" });
    await expect(resolveSupabaseIdentity(
      userClient({ error: { status: 403, message: "revoked" } }),
      "auth-server",
    )).resolves.toEqual({ status: "unauthenticated" });
  });

  it("fails closed on returned or thrown Auth-service validation failures without weaker fallback", async () => {
    const returned = await resolveSupabaseIdentity(
      userClient({ error: { status: 500, message: "Auth unavailable" } }),
      "auth-server",
    );
    expect(returned).toEqual({
      status: "infrastructure-error",
      code: "auth-unavailable",
      message: "Authentication is temporarily unavailable.",
    });

    const thrownClient: SupabaseIdentityClient = {
      auth: {
        getClaims: async () => ({ data: { claims: null }, error: null }),
        getUser: async () => {
          throw new Error("raw transport detail must not escape");
        },
      },
    };
    await expect(resolveSupabaseIdentity(thrownClient, "auth-server")).resolves.toEqual({
      status: "infrastructure-error",
      code: "auth-unavailable",
      message: "Authentication is temporarily unavailable.",
    });
  });

  it("rejects a malformed private identity result", async () => {
    await expect(resolveSupabaseIdentity(
      userClient({ user: { id: "not-a-uuid" } }),
      "auth-server",
    )).resolves.toEqual({ status: "unauthenticated" });
  });
});
