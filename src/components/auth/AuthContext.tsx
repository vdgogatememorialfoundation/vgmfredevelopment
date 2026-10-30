"use client";

import { createContext, useContext, useMemo, useSyncExternalStore } from "react";
import type { User } from "@/types";
import type { SessionScope } from "@/lib/auth";
import {
  storeSignIn,
  storeSignOut,
  storeSnapshot,
  storeSubscribe,
} from "@/lib/auth-store";

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  scope: SessionScope;
  signIn: (user: User) => void;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({
  children,
  scope = "public",
}: {
  children: React.ReactNode;
  scope?: SessionScope;
}) {
  const user = useSyncExternalStore(
    storeSubscribe,
    () => storeSnapshot(scope),
    () => null
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: user !== null,
      scope,
      signIn: (next) => storeSignIn(next, scope),
      signOut: () => storeSignOut(scope),
    }),
    [scope, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
