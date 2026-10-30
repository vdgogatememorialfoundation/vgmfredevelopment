import type { User } from "@/types";
import { clearSession, getSession, persistUntilLogoutEnabled, saveAccount, setSession } from "@/lib/auth";
import { recordActivity } from "@/lib/activity";

type Listener = () => void;

let snapshot: User | null = null;
let snapshotReady = false;
let browserBound = false;
const listeners = new Set<Listener>();

function withLoginStamp(user: User): User {
  if (user.lastLoginAt) return user;
  return { ...user, lastLoginAt: new Date().toISOString() };
}

function resolveSnapshot(): User | null {
  const session = getSession();
  if (!session) return null;
  if (session.lastLoginAt) return session;
  const stamped = withLoginStamp(session);
  setSession(stamped);
  return stamped;
}

function notify() {
  for (const listener of listeners) listener();
}

function refreshFromStorage() {
  snapshot = resolveSnapshot();
  snapshotReady = true;
  notify();
}

/** Re-apply the in-memory session if storage was emptied without Logout. */
function healIfMissing() {
  if (!persistUntilLogoutEnabled()) {
    refreshFromStorage();
    return;
  }
  const session = resolveSnapshot();
  if (session) {
    snapshot = session;
  } else if (snapshot) {
    setSession(snapshot);
  } else {
    snapshot = null;
  }
  snapshotReady = true;
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

export function storeSubscribe(listener: () => void) {
  bindBrowser();
  if (!snapshotReady) {
    snapshot = resolveSnapshot();
    snapshotReady = true;
  }
  listeners.add(listener);
  return function unsubscribe() {
    listeners.delete(listener);
  };
}

export function storeSnapshot(): User | null {
  bindBrowser();
  if (!snapshotReady) {
    snapshot = resolveSnapshot();
    snapshotReady = true;
  }
  return snapshot;
}

export function storeSignIn(user: User) {
  const next = { ...user, lastLoginAt: new Date().toISOString(), lastLogoutAt: undefined };
  saveAccount(next);
  setSession(next);
  snapshot = next;
  snapshotReady = true;
  notify();
  recordActivity({ email: next.email, kind: "login", detail: "Signed in" });
}

export function storeSignOut() {
  const email = snapshot?.email;
  snapshot = null;
  snapshotReady = true;
  if (email) {
    recordActivity({ email, kind: "logout", detail: "Signed out" });
  }
  clearSession();
  notify();
}
