import "server-only";

import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

const userIdSchema = z.uuid();

export type SupabaseIdentityClient = {
  auth: {
    getClaims: () => Promise<{
      data: { claims?: { sub?: unknown } | null } | null;
      error?: { message?: string } | null;
    }>;
    getUser: () => Promise<{
      data: { user?: { id?: unknown } | null } | null;
      error?: { message?: string; status?: number; name?: string } | null;
    }>;
  };
};

export type SupabaseIdentityAssurance = "claims" | "auth-server";

export type SupabaseIdentity =
  | { status: "unauthenticated" }
  | { status: "authenticated"; userId: string }
  | {
      status: "infrastructure-error";
      code: "auth-unavailable";
      message: string;
    };

function authenticatedUserId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return userIdSchema.safeParse(value).success ? value : null;
}

export async function resolveSupabaseIdentity(
  client: SupabaseIdentityClient,
  assurance: SupabaseIdentityAssurance,
): Promise<SupabaseIdentity> {
  if (assurance === "claims") {
    try {
      const { data, error } = await client.auth.getClaims();
      if (error !== null && error !== undefined) return { status: "unauthenticated" };
      const userId = authenticatedUserId(data?.claims?.sub);
      return userId === null
        ? { status: "unauthenticated" }
        : { status: "authenticated", userId };
    } catch {
      return { status: "unauthenticated" };
    }
  }

  let userResult: Awaited<ReturnType<SupabaseIdentityClient["auth"]["getUser"]>>;
  try {
    userResult = await client.auth.getUser();
  } catch {
    return {
      status: "infrastructure-error",
      code: "auth-unavailable",
      message: "Authentication is temporarily unavailable.",
    };
  }
  const { data, error } = userResult;
  if (error !== null && error !== undefined) {
    if (error.status === 401 || error.status === 403 || error.name === "AuthSessionMissingError") {
      return { status: "unauthenticated" };
    }
    return {
      status: "infrastructure-error",
      code: "auth-unavailable",
      message: "Authentication is temporarily unavailable.",
    };
  }

  const userId = authenticatedUserId(data?.user?.id);
  return userId === null
    ? { status: "unauthenticated" }
    : { status: "authenticated", userId };
}

export async function getSsrIdentity(): Promise<SupabaseIdentity> {
  return resolveSupabaseIdentity(await createClient(), "claims");
}

export async function getPrivateArtifactIdentity(): Promise<SupabaseIdentity> {
  return resolveSupabaseIdentity(await createClient(), "auth-server");
}
