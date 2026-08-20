"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  authEmailSchema,
  authMagicLinkIntentResponseSchema,
  sanitizeAuthRequestError,
} from "@/lib/auth/contracts";
import { getPublicEnv } from "@/lib/env/public";
import { createClient } from "@/lib/supabase/client";

type SignInState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "sent"; message: string }
  | { kind: "error"; message: string };

export function SignInForm() {
  const [email, setEmail] = React.useState("");
  const [state, setState] = React.useState<SignInState>({ kind: "idle" });
  const statusRef = React.useRef<HTMLParagraphElement | null>(null);
  const env = getPublicEnv();
  const configured = env.NEXT_PUBLIC_SUPABASE_URL !== undefined && env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY !== undefined;

  React.useEffect(() => {
    if (state.kind === "sent" || state.kind === "error") statusRef.current?.focus();
  }, [state.kind]);

  const submit = React.useCallback(async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!configured || state.kind === "submitting") return;
    const parsed = authEmailSchema.safeParse(email);
    if (!parsed.success) {
      setState({ kind: "error", message: "Enter a valid email address." });
      return;
    }

    setState({ kind: "submitting" });
    try {
      const intentResponse = await fetch("/api/auth/magic-link-intent", {
        method: "POST",
        credentials: "same-origin",
      });
      const intent = authMagicLinkIntentResponseSchema.safeParse(await intentResponse.json());
      if (!intentResponse.ok || !intent.success) {
        throw new Error("Magic Link intent could not be created.");
      }
      const client = createClient();
      const callback = `${window.location.origin}/auth/confirm?state=${encodeURIComponent(intent.data.state)}`;
      const { error } = await client.auth.signInWithOtp({
        email: parsed.data,
        options: { emailRedirectTo: callback },
      });
      if (error !== null) {
        setState({ kind: "error", message: sanitizeAuthRequestError(error).message });
        return;
      }
      setState({
        kind: "sent",
        message: "If this address can receive a UniProof sign-in link, open the newest link in this same browser.",
      });
    } catch (error) {
      setState({ kind: "error", message: sanitizeAuthRequestError(error).message });
    }
  }, [configured, email, state.kind]);

  if (!configured) {
    return (
      <div className="rounded-lg border border-border bg-muted/30 p-5">
        <p className="font-semibold">Account features are not configured in this environment.</p>
        <p className="mt-2 text-sm text-muted-foreground">Research, Compare, and Guide remain available without an account.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div>
        <label htmlFor="auth-email" className="block text-sm font-semibold">Email address</label>
        <input
          id="auth-email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          maxLength={254}
          value={email}
          disabled={state.kind === "submitting"}
          onChange={(event) => {
            setEmail(event.target.value);
            if (state.kind === "error") setState({ kind: "idle" });
          }}
          aria-describedby="auth-email-help auth-status"
          className="mt-2 min-h-11 w-full rounded-md border border-input bg-background px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
        />
        <p id="auth-email-help" className="mt-2 text-sm text-muted-foreground">
          UniProof will send a one-time sign-in link. Open it in this same browser; no password is required.
        </p>
      </div>
      <Button type="submit" disabled={state.kind === "submitting"} className="min-h-11">
        {state.kind === "submitting" ? "Sending…" : "Send sign-in link"}
      </Button>
      <p
        id="auth-status"
        ref={statusRef}
        role="status"
        aria-live="polite"
        tabIndex={state.kind === "sent" || state.kind === "error" ? -1 : undefined}
        className={state.kind === "error" ? "text-sm font-medium text-destructive" : "text-sm text-muted-foreground"}
      >
        {state.kind === "sent" || state.kind === "error" ? state.message : ""}
      </p>
    </form>
  );
}
