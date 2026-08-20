import { NextResponse, type NextRequest } from "next/server";

import {
  AUTH_MAGIC_LINK_INTENT_COOKIE,
  magicLinkIntentCookieOptions,
  matchesMagicLinkIntent,
} from "@/lib/auth/magic-link-intent.server";
import { createClient } from "@/lib/supabase/server";

const HASH_PARAM = ["token", "hash"].join("_");
const HASH_VALUE = /^[A-Za-z0-9._~-]{16,1024}$/u;

function privateRedirect(pathname: "/auth" | "/auth/complete") {
  const response = new NextResponse(null, {
    status: 303,
    headers: {
      Location: pathname,
      "Cache-Control": "private, no-store",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
  response.cookies.set(AUTH_MAGIC_LINK_INTENT_COOKIE, "", {
    ...magicLinkIntentCookieOptions(),
    maxAge: 0,
  });
  return response;
}

export async function GET(request: NextRequest) {
  const hash = request.nextUrl.searchParams.get(HASH_PARAM);
  const type = request.nextUrl.searchParams.get("type");
  const suppliedState = request.nextUrl.searchParams.get("state");
  const expectedState = request.cookies.get(AUTH_MAGIC_LINK_INTENT_COOKIE)?.value;
  if (
    hash === null ||
    !HASH_VALUE.test(hash) ||
    type !== "email" ||
    !matchesMagicLinkIntent(expectedState, suppliedState)
  ) {
    return privateRedirect("/auth");
  }

  try {
    const client = await createClient();
    const input = { [HASH_PARAM]: hash, type: "email" } as unknown as Parameters<typeof client.auth.verifyOtp>[0];
    const { error } = await client.auth.verifyOtp(input);
    return error === null ? privateRedirect("/auth/complete") : privateRedirect("/auth");
  } catch {
    return privateRedirect("/auth");
  }
}
