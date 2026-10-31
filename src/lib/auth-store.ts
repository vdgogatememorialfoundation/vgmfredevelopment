import type { User } from "@/types";
import {
  clearSession,
  getSession,
  isSignedOut,
  persistUntilLogoutEnabled,
  saveAccount,
  setSession,
  type SessionScope,
} from "@/lib/auth";
import { recordActivity } from "@/lib/activity";

type Listener = () => void;

const snapshots: Record<SessionScope, User | null> = { public: null, portal: null };
const ready: Record<SessionScope, boolean> = { public: false, portal: false };
let browserBound = false;
const listeners = new Set<Listener>();

function resolveSnapshot(scope: SessionScope): User | null {
  if (isSignedOut(scope)) return null;
  return getSession(scope);
}

function notify() {
  for (const listener of listeners) listener();
}

function refreshFromStorage() {
  snapshots.public = resolveSnapshot("public");
  snapshots.portal = resolveSnapshot("portal");
  ready.public = true;
  ready.portal = true;
  notify();
}

function healScope(scope: SessionScope) {
  if (isSignedOut(scope)) {
    snapshots[scope] = null;
    ready[scope] = true;
    return;
  }
  if (!persistUntilLogoutEnabled()) {
    snapshots[scope] = resolveSnapshot(scope);
    ready[scope] = true;
    return;
  }
  const session = resolveSnapshot(scope);
  if (session) {
    snapshots[scope] = session;
  } else {
    snapshots[scope] = null;
  }
  ready[scope] = true;
}

function healIfMissing() {
  healScope("public");
  healScope("portal");
  notify();
}

function bindBrowser() {
  if (typeof window === "undefined" || browserBound) return;
  browserBound = true;
  window.addEventListener("storage", refreshFromStorage);
  window.addEventListener("vgmf-cms", refreshFromStorage);
  window.addEventListener("focus", healIfMissing);
  window.addEventListener("pageshow", healIfMissing);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") healIfMissing();
  });
}

function ensureScope(scope: SessionScope) {
  bindBrowser();
  if (!ready[scope]) {
    snapshots[scope] = resolveSnapshot(scope);
    ready[scope] = true;
  }
}

export function storeSubscribe(listener: () => void) {
  bindBrowser();
  ensureScope("public");
  ensureScope("portal");
  listeners.add(listener);
  return function unsubscribe() {
    listeners.delete(listener);
  };
}

export function storeSnapshot(scope: SessionScope = "public"): User | null {
  ensureScope(scope);
  return snapshots[scope];
}

export function storeSignIn(user: User, scope?: SessionScope) {
  const next = { ...user, lastLoginAt: new Date().toISOString(), lastLogoutAt: undefined };
  const resolved = scope ?? (next.role === "admin" || next.role === "coadmin" || next.role === "staff" || next.role === "doctor" ? "portal" : "public");
  saveAccount(next);
  setSession(next, resolved);
  snapshots[resolved] = next;
  ready[resolved] = true;
  notify();
  recordActivity({ email: next.email, kind: "login", detail: "Signed in" });
}

export function storeSignOut(scope: SessionScope = "public") {
  const email = snapshots[scope]?.email;
  snapshots[scope] = null;
  ready[scope] = true;
  clearSession(scope);
  if (typeof window !== "undefined") {
    try {
      window.sessionStorage.removeItem("vgmf_partner_hydrated_at");
      window.sessionStorage.removeItem("vgmf_partner_hydrated_email");
    } catch {
      /* private mode */
    }
  }
  if (email) {
    recordActivity({ email, kind: "logout", detail: "Signed out" });
  }
  notify();
}
