import type { NextRequest } from "next/server";

import { getPublicEnv } from "@/lib/env/public";
import { updateSession } from "@/lib/supabase/proxy";
import {
  buildContentSecurityPolicy,
  parseSupabaseConnectOrigin,
} from "@/lib/security/browser-policy";

function createNonce(): string {
  return crypto.randomUUID().replaceAll("-", "");
}

export async function proxy(request: NextRequest) {
  const nonce = createNonce();
  const publicEnv = getPublicEnv();
  const supabaseConfigured =
    publicEnv.NEXT_PUBLIC_SUPABASE_URL !== undefined &&
    publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY !== undefined;
  if (
    !supabaseConfigured &&
    (publicEnv.NEXT_PUBLIC_SUPABASE_URL !== undefined ||
      publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY !== undefined)
  ) {
    throw new Error("Supabase browser configuration is incomplete.");
  }
  const isDevelopment = process.env.NODE_ENV !== "production";
  const policy = buildContentSecurityPolicy({
    nonce,
    isDevelopment,
    requestUrl: request.url,
    requestHost: request.headers.get("host") ?? undefined,
    ...(supabaseConfigured
      ? {
          supabaseConnectOrigin: parseSupabaseConnectOrigin(
            publicEnv.NEXT_PUBLIC_SUPABASE_URL!,
            isDevelopment,
          ),
        }
      : {}),
  });
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("Content-Security-Policy", policy);
  requestHeaders.set("x-nonce", nonce);

  const response = await updateSession(request, requestHeaders);
  response.headers.set("Content-Security-Policy", policy);
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!api/research(?:/|$)|_next/static|_next/image|favicon.ico|icon.svg).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
