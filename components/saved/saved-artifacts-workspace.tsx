"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";

import { useAuthSession } from "@/components/auth/auth-session-provider";
import { SavedArtifactCard } from "@/components/saved/saved-artifact-card";
import { useSavedRestore } from "@/components/saved/saved-restore-provider";
import { Button } from "@/components/ui/button";
import {
  deleteSavedArtifact,
  getSavedArtifact,
  listSavedArtifacts,
} from "@/lib/persistence/client";
import { savedArtifactSchema, type SavedArtifactMetadata } from "@/lib/persistence/contracts";

function routeForKind(kind: "profile" | "research" | "comparison" | "guide"): string {
  if (kind === "research") return "/research";
  if (kind === "comparison") return "/compare";
  return "/guide";
}

export function SavedArtifactsWorkspace() {
  const { state: authState } = useAuthSession();
  const { publish, clear } = useSavedRestore();
  const router = useRouter();
  const [items, setItems] = React.useState<readonly SavedArtifactMetadata[]>([]);
  const [status, setStatus] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [confirmId, setConfirmId] = React.useState<string | null>(null);
  const mountedRef = React.useRef(true);
  const operationRef = React.useRef(0);
  const refreshButtonRef = React.useRef<HTMLButtonElement | null>(null);
  const accountId = authState.status === "signed-in" ? authState.userId : null;
  const accountRef = React.useRef<string | null>(accountId);

  React.useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      operationRef.current += 1;
    };
  }, []);

  const refresh = React.useCallback(async (message?: string) => {
    if (accountId === null) return;
    const operation = operationRef.current + 1;
    operationRef.current = operation;
    const owner = accountId;
    setLoading(true);
    if (message === undefined) setStatus("");
    const result = await listSavedArtifacts();
    if (!mountedRef.current || operation !== operationRef.current || accountRef.current !== owner) return;
    setLoading(false);
    if (!result.ok) {
      setItems([]);
      setStatus(result.error.message);
      return;
    }
    setItems(result.value);
    setStatus(message ?? "");
  }, [accountId]);

  React.useEffect(() => {
    if (accountRef.current !== accountId) {
      operationRef.current += 1;
      accountRef.current = accountId;
      setItems([]);
      setBusyId(null);
      setConfirmId(null);
      setStatus("");
      clear();
    }
    if (accountId !== null) queueMicrotask(() => void refresh());
  }, [accountId, clear, refresh]);

  if (authState.status === "loading") {
    return <p className="text-sm text-muted-foreground" role="status">Checking account…</p>;
  }

  if (authState.status !== "signed-in") {
    return (
      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-xl font-semibold">Sign in to view saved snapshots</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">Your unsaved Research, Compare, and Guide work remains available without an account.</p>
        {authState.configured ? (
          <Button asChild className="mt-5"><Link href="/auth">Sign in</Link></Button>
        ) : null}
      </div>
    );
  }

  const restore = async (artifact: SavedArtifactMetadata) => {
    if (busyId !== null) return;
    const operation = operationRef.current + 1;
    operationRef.current = operation;
    const owner = accountId;
    if (owner === null) return;
    setBusyId(artifact.id);
    setStatus("");
    const result = await getSavedArtifact(artifact.id);
    if (!mountedRef.current || operation !== operationRef.current || accountRef.current !== owner) return;
    setBusyId(null);
    if (!result.ok) {
      setStatus(result.error.message);
      return;
    }
    const parsed = savedArtifactSchema.safeParse({
      kind: result.value.kind,
      schemaVersion: result.value.schemaVersion,
      payload: result.value.payload,
    });
    if (!parsed.success || parsed.data.kind !== artifact.kind) {
      setStatus("This saved snapshot is invalid and cannot be restored.");
      return;
    }
    if (publish(parsed.data) === null) {
      setStatus("The account changed before the snapshot could be restored.");
      return;
    }
    router.push(routeForKind(parsed.data.kind));
  };

  const remove = async (artifact: SavedArtifactMetadata) => {
    if (busyId !== null) return;
    const operation = operationRef.current + 1;
    operationRef.current = operation;
    const owner = accountId;
    if (owner === null) return;
    setBusyId(artifact.id);
    setStatus("");
    const result = await deleteSavedArtifact(artifact.id);
    if (!mountedRef.current || operation !== operationRef.current || accountRef.current !== owner) return;
    setBusyId(null);
    setConfirmId(null);
    if (!result.ok && !result.ambiguousMutation) {
      setStatus(result.error.message);
      requestAnimationFrame(() => refreshButtonRef.current?.focus());
      return;
    }
    await refresh(result.ok
      ? "Saved snapshot deleted."
      : "The delete outcome was uncertain, so the saved list was refreshed before another action.");
    requestAnimationFrame(() => refreshButtonRef.current?.focus());
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Up to 20 private snapshots are stored for this account.</p>
        <Button ref={refreshButtonRef} type="button" variant="outline" disabled={loading || busyId !== null} onClick={() => void refresh()}>Refresh list</Button>
      </div>
      <p role="status" aria-live="polite" className="mt-3 min-h-5 text-sm text-muted-foreground">{loading ? "Loading saved snapshots…" : status}</p>
      {items.length === 0 && !loading ? (
        <div className="mt-6 rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No saved snapshots yet.</div>
      ) : (
        <div className="mt-6 space-y-4">
          {items.map((artifact) => (
            <SavedArtifactCard
              key={artifact.id}
              artifact={artifact}
              busy={busyId !== null}
              confirmingDelete={confirmId === artifact.id}
              onRestore={() => void restore(artifact)}
              onRequestDelete={() => setConfirmId(artifact.id)}
              onCancelDelete={() => setConfirmId(null)}
              onConfirmDelete={() => void remove(artifact)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
