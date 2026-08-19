"use client";

import Link from "next/link";
import * as React from "react";

import { authSessionResponseSchema } from "@/lib/auth/contracts";

const SESSION_CONFIRM_ATTEMPTS = 10;
const SESSION_CONFIRM_DELAY_MS = 100;

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

export function AuthCompletionRedirect() {
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    void (async () => {
      for (let attempt = 0; attempt < SESSION_CONFIRM_ATTEMPTS; attempt += 1) {
        try {
          const response = await fetch("/api/auth/session", {
            cache: "no-store",
            credentials: "same-origin",
          });
          if (response.ok) {
            const parsed = authSessionResponseSchema.safeParse(await response.json());
            if (parsed.success && parsed.data.authenticated) {
              window.location.replace("/saved");
              return;
            }
          }
        } catch {
          // Retry only within this bounded confirmation window.
        }
        if (!active) return;
        await delay(SESSION_CONFIRM_DELAY_MS);
        if (!active) return;
      }
      if (active) setFailed(true);
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <main id="main-content" className="mx-auto w-full max-w-2xl px-5 py-16 sm:px-8">
      <section aria-labelledby="auth-complete-heading" className="rounded-xl border border-border bg-card p-6">
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary">Account</p>
        <h1 id="auth-complete-heading" className="mt-3 text-2xl font-bold tracking-tight">Completing sign-in</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground" role="status" aria-live="polite">
          {failed
            ? "The session could not be confirmed. No private saved data was opened."
            : "Confirming your session before opening private saved snapshots."}
        </p>
        {failed ? (
          <p className="mt-4 text-sm text-muted-foreground">
            <Link className="font-medium text-primary underline underline-offset-4" href="/auth">Return to sign in</Link> and request a new link.
          </p>
        ) : null}
      </section>
    </main>
  );
}
