"use client";

import Link from "next/link";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { useAuthSession } from "./auth-session-provider";

export function AccountMenu() {
  const { state, signOutCurrentSession } = useAuthSession();
  const [message, setMessage] = React.useState("");
  const [signingOut, setSigningOut] = React.useState(false);

  if (state.status === "loading") {
    return <span className="hidden min-h-10 items-center text-sm text-muted-foreground sm:inline-flex">Account…</span>;
  }

  if (state.status === "signed-out") {
    if (!state.configured) return null;
    return (
      <Button asChild variant="outline" className="h-[42px] px-4">
        <Link href="/auth">Sign in</Link>
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="ghost"
        className="h-[42px] px-3"
        disabled={signingOut}
        aria-describedby={message === "" ? undefined : "account-action-status"}
        onClick={async () => {
          if (signingOut) return;
          setSigningOut(true);
          setMessage("");
          const ok = await signOutCurrentSession();
          setSigningOut(false);
          if (!ok) setMessage("Sign out could not be completed. Try again.");
        }}
      >
        {signingOut ? "Signing out…" : "Sign out"}
      </Button>
      {message === "" ? null : (
        <span id="account-action-status" role="status" className="sr-only">{message}</span>
      )}
    </div>
  );
}
