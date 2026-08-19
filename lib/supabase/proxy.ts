import "server-only";

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getPublicEnv } from "@/lib/env/public";

type ProxyCookie = {
  name: string;
  value: string;
  options?: Record<string, unknown>;
};

export type SupabaseProxyCookieMethods = {
  getAll: () => ProxyCookie[];
  setAll: (
    cookies: ProxyCookie[],
    headers: Record<string, string>,
  ) => Promise<void> | void;
};

export type SupabaseProxyClient = {
  auth: {
    getClaims: () => Promise<{
      data: { claims?: { sub?: unknown } | null } | null;
      error?: { message?: string } | null;
    }>;
  };
};

const cacheHeaderAllowlist = new Set(["cache-control", "expires", "pragma"]);
const privateCacheHeaders = {
  "Cache-Control": "private, no-store",
  Expires: "0",
  Pragma: "no-cache",
} as const;

function hasSupabaseAuthTokenCookie(cookies: readonly ProxyCookie[]): boolean {
  return cookies.some(({ name }) => name.startsWith("sb-") && name.includes("auth-token"));
}

function applyCacheProtectionHeaders(
  response: NextResponse,
  headers: Record<string, string>,
): void {
  for (const [name, value] of Object.entries(headers)) {
    const normalized = name.toLowerCase();
    if (!cacheHeaderAllowlist.has(normalized)) continue;
    if (value === "" || /[\u0000-\u001f\u007f]/u.test(value)) continue;

    if (normalized === "cache-control") {
      const directives = new Set(
        value.split(",").map((directive) => directive.trim().toLowerCase()).filter(Boolean),
      );
      directives.add("private");
      directives.add("no-store");
      response.headers.set("Cache-Control", [...directives].join(", "));
    } else {
      response.headers.set(name, value);
    }
  }

  if (response.headers.get("Cache-Control") === null) {
    response.headers.set("Cache-Control", "private, no-store");
  }
}

export async function updateSupabaseSession(
  request: NextRequest,
  requestHeaders: Headers,
  createClient: (cookies: SupabaseProxyCookieMethods) => SupabaseProxyClient,
): Promise<NextResponse> {
  const cookiesToSet = new Map<string, ProxyCookie>();
  let response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  if (hasSupabaseAuthTokenCookie(request.cookies.getAll())) {
    applyCacheProtectionHeaders(response, privateCacheHeaders);
  }

  const cookieMethods: SupabaseProxyCookieMethods = {
    getAll() {
      return request.cookies.getAll();
    },
    setAll(cookies, headers) {
      for (const cookie of cookies) {
        cookiesToSet.set(cookie.name, cookie);
        request.cookies.set(cookie);
      }

      response = NextResponse.next({
        request: { headers: requestHeaders },
      });
      for (const cookie of cookiesToSet.values()) {
        response.cookies.set(cookie.name, cookie.value, cookie.options);
      }
      applyCacheProtectionHeaders(response, headers);
      if (hasSupabaseAuthTokenCookie(request.cookies.getAll())) {
        applyCacheProtectionHeaders(response, privateCacheHeaders);
      }
    },
  };

  const client = createClient(cookieMethods);
  try {
    await client.auth.getClaims();
    return response;
  } catch {
    return response;
  }
}

export async function updateSession(
  request: NextRequest,
  requestHeaders: Headers,
): Promise<NextResponse> {
  const env = getPublicEnv();
  if (
    env.NEXT_PUBLIC_SUPABASE_URL === undefined ||
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY === undefined
  ) {
    return NextResponse.next({
      request: { headers: requestHeaders },
    });
  }

  return updateSupabaseSession(request, requestHeaders, (cookies) =>
    createServerClient(
      env.NEXT_PUBLIC_SUPABASE_URL!,
      env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      {
        cookies: {
          getAll: cookies.getAll,
          setAll: cookies.setAll,
        },
      },
    ),
  );
}
