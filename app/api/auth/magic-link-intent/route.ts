import { NextResponse, type NextRequest } from "next/server";

import {
  AUTH_MAGIC_LINK_INTENT_COOKIE,
  createMagicLinkIntentState,
  magicLinkIntentCookieOptions,
} from "@/lib/auth/magic-link-intent.server";
import { isAllowedSameOriginMutation } from "@/lib/security/same-origin";

function json(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isAllowedSameOriginMutation(request)) {
    return json({ error: "forbidden-origin" }, 403);
  }

  const state = createMagicLinkIntentState();
  const response = json({ state });
  response.cookies.set(AUTH_MAGIC_LINK_INTENT_COOKIE, state, magicLinkIntentCookieOptions());
  return response;
}
