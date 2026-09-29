"use client";

import { useState } from "react";
import { ArrowRight, CheckCircle2, Mail } from "lucide-react";

export default function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "done" | "error">("idle");

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setStatus("error");
      return;
    }
    setStatus("done");
    setEmail("");
  };

  if (status === "done") {
    return (
      <p className="flex items-center gap-2 rounded-xl border border-sage/40 bg-sage/15 px-4 py-3 text-sm text-white">
        <CheckCircle2 size={18} className="text-emerald-300" />
        Thank you — you&apos;re subscribed to Foundation updates.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="w-full">
      <label htmlFor="newsletter-email" className="sr-only">
        Email address
      </label>
      <div className="flex items-center gap-2 rounded-full border border-white/15 bg-white/5 p-1.5 pl-4 backdrop-blur focus-within:border-gold">
        <Mail size={16} className="shrink-0 text-white/50" />
        <input
          id="newsletter-email"
          type="email"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            setStatus("idle");
          }}
          placeholder="Your email address"
          className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/40"
        />
        <button type="submit" className="btn-gold shrink-0 px-4 py-2 text-sm">
          Subscribe
          <ArrowRight size={15} />
        </button>
      </div>
      {status === "error" && (
        <p className="mt-2 pl-4 text-xs text-red-300">Please enter a valid email address.</p>
      )}
    </form>
  );
}
