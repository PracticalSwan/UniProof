import { NextResponse } from "next/server";

import { isAllowedSameOriginMutation } from "@/lib/security/same-origin";
import { createClient } from "@/lib/supabase/server";

function json(value: unknown, status = 200) {
  return NextResponse.json(value, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}

export async function POST(request: Request) {
  if (!isAllowedSameOriginMutation(request)) {
    return json({ error: "forbidden-origin", message: "Cross-origin sign-out requests are not allowed." }, 403);
  }

  try {
    const client = await createClient();
    const { error } = await client.auth.signOut({ scope: "local" });
    if (error !== null) return json({ error: "auth-unavailable", message: "Sign out could not be completed." }, 503);
    return json({ signedOut: true });
  } catch {
    return json({ error: "auth-unavailable", message: "Sign out could not be completed." }, 503);
  }
}
