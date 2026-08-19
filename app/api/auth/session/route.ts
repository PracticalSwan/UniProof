import { NextResponse } from "next/server";

import { authSessionResponseSchema } from "@/lib/auth/contracts";
import { getPrivateArtifactIdentity } from "@/lib/auth/session";

function responseJson(value: unknown, status = 200) {
  return NextResponse.json(value, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}

export async function GET() {
  try {
    const identity = await getPrivateArtifactIdentity();
    if (identity.status === "infrastructure-error") {
      return responseJson({ error: "auth-unavailable" }, 503);
    }
    if (identity.status === "unauthenticated") {
      return responseJson(authSessionResponseSchema.parse({ authenticated: false }));
    }
    return responseJson(authSessionResponseSchema.parse({
      authenticated: true,
      userId: identity.userId,
    }));
  } catch {
    return responseJson({ error: "auth-unavailable" }, 503);
  }
}
