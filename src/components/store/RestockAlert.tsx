"use client";

import { useState } from "react";
import { useAuth } from "@/components/auth/AuthContext";
import { addStockAlert } from "@/lib/product-data";

export default function RestockAlert({ bookId }: { bookId: string }) {
  const { user } = useAuth();
  const [email, setEmail] = useState(user?.email || "");
  const [note, setNote] = useState("");

  return (
    <form
      className="mt-3 flex flex-wrap items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        try {
          const saved = addStockAlert(bookId, email || user?.email || "", user ? `${user.firstName} ${user.lastName}` : undefined);
          setNote(saved ? "We will notify you when this is restocked." : "You are already on the restock list.");
        } catch (problem) {
          setNote(problem instanceof Error ? problem.message : "Could not save the alert.");
        }
      }}
    >
      <input
        className="input-field w-48 py-2"
        type="email"
        required
        placeholder="Email for restock"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
      />
      <button type="submit" className="btn-outline px-3 py-2 text-xs">Notify me when restocked</button>
      {note && <span className="text-xs text-emerald-800">{note}</span>}
    </form>
  );
}
