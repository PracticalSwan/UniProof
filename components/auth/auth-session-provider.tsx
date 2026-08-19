"use client";

import * as React from "react";

export type AuthUiState =
  | { status: "loading"; configured: true }
  | { status: "signed-out"; configured: boolean }
  | { status: "signed-in"; configured: true; userId: string };

type AuthSessionContextValue = Readonly<{
  state: AuthUiState;
  signOutCurrentSession: () => Promise<boolean>;
}>;

const AuthSessionContext = React.createContext<AuthSessionContextValue | null>(null);

export function AuthSessionProvider({
  children,
  initialState,
}: Readonly<{ children: React.ReactNode; initialState: AuthUiState }>) {
  const [state, setState] = React.useState<AuthUiState>(initialState);

  const signOutCurrentSession = React.useCallback(async () => {
    try {
      const response = await fetch("/api/auth/sign-out", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json; charset=utf-8" },
        body: "{}",
      });
      if (!response.ok) return false;
      const body = await response.json() as { signedOut?: unknown };
      if (body.signedOut !== true) return false;
      setState({ status: "signed-out", configured: true });
      return true;
    } catch {
      return false;
    }
  }, []);

  const value = React.useMemo<AuthSessionContextValue>(() => ({ state, signOutCurrentSession }), [state, signOutCurrentSession]);
  return <AuthSessionContext.Provider value={value}>{children}</AuthSessionContext.Provider>;
}

export function useAuthSession(): AuthSessionContextValue {
  const value = React.useContext(AuthSessionContext);
  if (value === null) throw new Error("useAuthSession must be used inside AuthSessionProvider.");
  return value;
}
