import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { checkSession, getSession, logoutSession, saveSession, type Session } from "./api";

type AuthValue = {
  session: Session | null;
  setSession: (next: Session | null) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSessionState] = useState<Session | null>(getSession());

  useEffect(() => {
    void checkSession().then((next) => setSessionState(next));
  }, []);

  const setSession = useCallback(async (next: Session | null) => {
    await saveSession(next);
    setSessionState(next);
  }, []);

  const signOut = useCallback(async () => {
    await logoutSession();
    setSessionState(null);
  }, []);

  return <AuthContext.Provider value={{ session, setSession, signOut }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("AuthProvider missing");
  return value;
}
