"use client";

import { useState } from "react";
import { ArrowRight, CheckCircle2, Mail } from "lucide-react";
import { submitPublic } from "@/lib/public-submit";

export default function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "done" | "error">("idle");

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setStatus("error");
      return;
    }
    void submitPublic("subscribers", { email, source: "Website footer" });
    setStatus("done");
    setEmail("");
  };

  if (status === "done") {
    return (
      <p className="flex items-center gap-2 rounded-xl border border-white/40 bg-white/20 px-4 py-3 text-sm text-white">
        <CheckCircle2 size={18} className="text-white" />
        Thank you — you&apos;re subscribed to Foundation updates.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="w-full">
      <label htmlFor="newsletter-email" className="sr-only">
        Email address
      </label>
      <div className="flex items-center gap-2 rounded-full border border-white bg-white p-1.5 pl-4 shadow-lg focus-within:ring-4 focus-within:ring-white/30">
        <Mail size={16} className="shrink-0 text-burgundy" />
        <input
          id="newsletter-email"
          type="email"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            setStatus("idle");
          }}
          placeholder="Your email address"
          className="min-w-0 flex-1 bg-transparent text-sm text-text-primary outline-none placeholder:text-text-muted"
        />
        <button type="submit" className="btn-primary shrink-0 px-4 py-2 text-sm">
          Subscribe
          <ArrowRight size={15} />
        </button>
      </div>
      {status === "error" && (
        <p className="mt-2 pl-4 text-xs font-semibold text-white">Please enter a valid email address.</p>
      )}
    </form>
  );
}
