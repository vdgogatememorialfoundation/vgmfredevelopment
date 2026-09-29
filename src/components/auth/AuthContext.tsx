"use client";

import { createContext, useContext, useSyncExternalStore } from "react";
import type { User } from "@/types";
import {
  storeSignIn,
  storeSignOut,
  storeSnapshot,
  storeSubscribe,
} from "@/lib/auth-store";

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  signIn: (user: User) => void;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const user = useSyncExternalStore(
    storeSubscribe,
    storeSnapshot,
    () => null
  );

  const value: AuthContextValue = {
    user,
    isAuthenticated: user !== null,
    signIn: storeSignIn,
    signOut: storeSignOut,
  };

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}