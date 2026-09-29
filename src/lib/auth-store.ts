import type { User } from "@/types";
import { clearSession, getSession, setSession } from "@/lib/auth";

type Listener = () => void;

let snapshot: User | null = null;
let snapshotReady = false;
const listeners = new Set<Listener>();

function resolveSnapshot(): User | null {
  return getSession();
}

function notify() {
  for (const listener of listeners) listener();
}

export function storeSubscribe(listener: () => void) {
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
  if (!snapshotReady) {
    snapshot = resolveSnapshot();
    snapshotReady = true;
  }
  return snapshot;
}

export function storeSignIn(user: User) {
  setSession(user);
  snapshot = user;
  snapshotReady = true;
  notify();
}

export function storeSignOut() {
  clearSession();
  snapshot = null;
  snapshotReady = true;
  notify();
}