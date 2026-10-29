"use client";

import { useMemo, useState } from "react";
import { displayName } from "@/lib/admin-store";
import { matchesAccountQuery } from "@/lib/account-search";
import type { User } from "@/types";

export function AccountSearch({
  accounts,
  selectedEmail,
  onSelect,
  placeholder = "Search by name, phone or email",
  emptyLabel = "Guest / walk-in",
}: {
  accounts: User[];
  selectedEmail: string;
  onSelect: (account: User | null) => void;
  placeholder?: string;
  emptyLabel?: string;
}) {
  const [query, setQuery] = useState("");
  const selected = accounts.find((account) => account.email === selectedEmail) ?? null;
  const matches = useMemo(() => {
    const q = query.trim();
    if (!q) return [];
    return accounts.filter((account) => matchesAccountQuery(account, q)).slice(0, 8);
  }, [accounts, query]);

  return (
    <div className="space-y-2">
      {selected && (
        <div className="flex items-start justify-between gap-3 rounded-xl border border-burgundy/20 bg-burgundy/5 px-3 py-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-text-primary">{displayName(selected, true) || selected.email}</p>
            <p className="truncate text-xs text-text-muted">
              {[selected.accountId, selected.email, selected.phone].filter(Boolean).join(" · ")}
            </p>
          </div>
          <button
            type="button"
            className="shrink-0 text-xs font-semibold text-burgundy"
            onClick={() => {
              onSelect(null);
              setQuery("");
            }}
          >
            Clear
          </button>
        </div>
      )}
      <input
        className="input-field"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={selected ? "Search another account…" : placeholder}
        autoComplete="off"
      />
      {query.trim() !== "" && (
        <ul className="overflow-hidden rounded-xl border border-border bg-white">
          {matches.length === 0 ? (
            <li className="px-3 py-2 text-sm text-text-muted">No accounts match. {emptyLabel} details can be typed below.</li>
          ) : (
            matches.map((account) => (
              <li key={account.email}>
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left hover:bg-warm-cream"
                  onClick={() => {
                    onSelect(account);
                    setQuery("");
                  }}
                >
                  <span className="block text-sm font-semibold text-text-primary">{displayName(account, true) || account.email}</span>
                  <span className="block text-xs text-text-muted">
                    {[account.accountId, account.email, account.phone].filter(Boolean).join(" · ")}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
