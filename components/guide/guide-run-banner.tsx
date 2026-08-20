"use client";

import { Button } from "@/components/ui/button";
import type { GuideWorkspaceState } from "@/lib/guide/client-state";

const GUIDE_ERROR_MESSAGES: Record<string, string> = {
  "invalid-content-type": "The research request could not be accepted. Check the public target context and start a new assessment.",
  "invalid-json": "The research request could not be accepted. Check the public target context and start a new assessment.",
  "invalid-request": "The research request is invalid. Correct the highlighted public fields and start a new assessment.",
  "request-too-large": "The research request is too large. Shorten the public intake/year context and try again.",
  "unsupported-target": "The selected program is no longer supported. Choose a different supported program.",
  "sensitive-input": "The public Research context could not be accepted. Edit the public intake/year fields and start a new assessment.",
  "forbidden-origin": "The research request was blocked by browser origin controls.",
  "internal-error": "UniProof could not complete this research request.",
  "deployment-rate-limit": "The deployment is temporarily limiting research requests. Try again explicitly in a moment.",
  "deployment-timeout": "The deployment timed out before the research request completed. Try again explicitly.",
  "network-error": "The research request could not be sent. Check the connection and try again.",
  "invalid-response": "The research response could not be safely validated for Guide.",
  "guide-assessment-error": "Guide could not safely assess the researched requirements. Try refreshing the requirements.",
};

interface GuideRunBannerProps {
  state: GuideWorkspaceState;
  retryable: boolean;
  onRetry: () => void;
}

export function GuideRunBanner({ state, retryable, onRetry }: GuideRunBannerProps) {
  let message: string | null = null;
  let role: "status" | "alert" | undefined;

  if (state.kind === "loading") {
    message = "Researching published requirements. Your profile stays in this tab.";
    role = "status";
  } else if (state.kind === "error") {
    message = GUIDE_ERROR_MESSAGES[state.error.code] ?? "The Guide assessment could not be completed safely.";
    role = "alert";
  } else if (state.kind === "result") {
    message = state.notice ?? (state.result.status === "partial"
      ? "Partial result ready. Some requirement categories could not be fully researched."
      : "Assessment complete. This checks published requirements; it does not predict admission.");
    role = "status";
  } else if (state.notice !== undefined) {
    message = state.notice;
    role = "status";
  }

  if (message === null) return null;

  return (
    <div
      role={role}
      aria-live="polite"
      aria-label={state.kind === "error" ? "Guide request error" : undefined}
      className={`rounded-md border p-4 text-sm ${
        state.kind === "error"
          ? "border-destructive/30 bg-destructive/5 text-destructive"
          : "border-border bg-accent text-foreground"
      }`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <p className="min-w-0 break-words">{message}</p>
        {state.kind === "error" && retryable ? (
          <div className="shrink-0 space-y-1 sm:text-right">
            <Button type="button" onClick={onRetry}>
              Retry this assessment
            </Button>
            <p className="max-w-sm text-xs text-muted-foreground">
              Retry repeats the exact failed immutable Research request. Assess starts from the current form.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
