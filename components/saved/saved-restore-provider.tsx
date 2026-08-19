"use client";

import * as React from "react";

import { useAuthSession } from "@/components/auth/auth-session-provider";
import type { SavedArtifact, SavedArtifactKind } from "@/lib/persistence/contracts";

type RestoreHandoff = Readonly<{
  accountId: string;
  token: number;
  artifact: SavedArtifact;
}>;

type SavedRestoreContextValue = Readonly<{
  publish: (artifact: SavedArtifact) => number | null;
  consume: <K extends SavedArtifactKind>(kind: K) => Extract<SavedArtifact, { kind: K }> | null;
  clear: () => void;
}>;

const SavedRestoreContext = React.createContext<SavedRestoreContextValue | null>(null);

export function SavedRestoreProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const { state: authState } = useAuthSession();
  const handoffRef = React.useRef<RestoreHandoff | null>(null);
  const sequenceRef = React.useRef(0);
  const accountRef = React.useRef<string | null>(null);

  const currentAccountId = authState.status === "signed-in" ? authState.userId : null;

  const clear = React.useCallback(() => {
    handoffRef.current = null;
  }, []);

  React.useEffect(() => {
    if (accountRef.current !== currentAccountId) {
      handoffRef.current = null;
      accountRef.current = currentAccountId;
    }
  }, [currentAccountId]);

  const publish = React.useCallback((artifact: SavedArtifact): number | null => {
    if (currentAccountId === null) return null;
    const token = sequenceRef.current + 1;
    sequenceRef.current = token;
    handoffRef.current = { accountId: currentAccountId, token, artifact };
    return token;
  }, [currentAccountId]);

  const consume = React.useCallback(<K extends SavedArtifactKind>(kind: K): Extract<SavedArtifact, { kind: K }> | null => {
    const handoff = handoffRef.current;
    if (
      handoff === null ||
      currentAccountId === null ||
      handoff.accountId !== currentAccountId ||
      handoff.artifact.kind !== kind
    ) {
      return null;
    }
    handoffRef.current = null;
    return handoff.artifact as Extract<SavedArtifact, { kind: K }>;
  }, [currentAccountId]);

  const value = React.useMemo<SavedRestoreContextValue>(() => ({
    publish,
    consume,
    clear,
  }), [clear, consume, publish]);

  return <SavedRestoreContext.Provider value={value}>{children}</SavedRestoreContext.Provider>;
}

export function useSavedRestore(): SavedRestoreContextValue {
  const value = React.useContext(SavedRestoreContext);
  if (value === null) throw new Error("useSavedRestore must be used inside SavedRestoreProvider.");
  return value;
}
