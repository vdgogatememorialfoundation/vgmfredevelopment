"use client";

import { useAuth } from "@/components/auth/AuthContext";
import { formatDateTime } from "@/lib/utils";

export function LoginStamp({
  onLogout,
  compact = false,
  onDark = false,
}: {
  onLogout: () => void;
  compact?: boolean;
  onDark?: boolean;
}) {
  const { user } = useAuth();
  if (!user) return null;
  const signedIn = user.lastLoginAt ? formatDateTime(user.lastLoginAt) : "this session";

  return (
    <div className={`flex flex-wrap items-center gap-2 ${compact ? "text-[11px]" : "text-xs"}`}>
      <p className={onDark ? "text-white/70" : "text-slate-500"}>
        Login time: <span className={onDark ? "font-semibold text-white" : "font-semibold text-slate-800"}>{signedIn}</span>
      </p>
      <button
        type="button"
        onClick={onLogout}
        className={
          onDark
            ? "rounded-lg border border-white/40 bg-white/10 px-3 py-1.5 font-semibold text-white transition hover:bg-white hover:text-ink"
            : "rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-semibold text-slate-800 transition hover:border-burgundy hover:text-burgundy"
        }
      >
        Logout
      </button>
    </div>
  );
}
