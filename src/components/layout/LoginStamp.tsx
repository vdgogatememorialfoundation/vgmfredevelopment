"use client";

import { useAuth } from "@/components/auth/AuthContext";
import { formatDateTime } from "@/lib/utils";

export function LoginStamp({
  onLogout,
  compact = false,
}: {
  onLogout: () => void;
  compact?: boolean;
}) {
  const { user } = useAuth();
  if (!user) return null;
  const signedIn = user.lastLoginAt ? formatDateTime(user.lastLoginAt) : "this session";

  return (
    <div className={`flex flex-wrap items-center gap-2 ${compact ? "text-[11px]" : "text-xs"}`}>
      <p className="text-slate-500">
        Login time: <span className="font-semibold text-slate-800">{signedIn}</span>
      </p>
      <button
        type="button"
        onClick={onLogout}
        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-semibold text-slate-800 transition hover:border-burgundy hover:text-burgundy"
      >
        Logout
      </button>
    </div>
  );
}
