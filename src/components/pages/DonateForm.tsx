"use client";

import { useState } from "react";
import { CheckCircle2, HeartHandshake, Lock, Repeat } from "lucide-react";
import DynamicIcon from "@/components/common/DynamicIcon";
import { donationCauses, donationTiers } from "@/data/site";
import { classNames, formatCurrency } from "@/lib/utils";

export default function DonateForm() {
  const [amount, setAmount] = useState<number>(donationTiers[1].amount);
  const [custom, setCustom] = useState("");
  const [cause, setCause] = useState<string>(donationCauses[0].title);
  const [frequency, setFrequency] = useState<"once" | "monthly">("once");
  const [submitted, setSubmitted] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");

  const finalAmount = custom ? Number(custom) : amount;
  const selectedTier = donationTiers.find((tier) => tier.amount === finalAmount);

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim() || !/^\S+@\S+\.\S+$/.test(email)) {
      setError("Please enter your name and a valid email address.");
      return;
    }
    if (!finalAmount || finalAmount < 100) {
      setError("Minimum contribution is ₹100.");
      return;
    }
    setError("");
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="card-static p-8 text-center sm:p-12">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-sage-light text-sage">
          <CheckCircle2 size={32} />
        </span>
        <h2 className="mt-6 font-display text-3xl font-semibold">Thank you, {name.split(" ")[0]}!</h2>
        <p className="mx-auto mt-3 max-w-md text-text-muted">
          Your pledge of <strong className="text-text-primary">{formatCurrency(finalAmount, "INR")}</strong>
          {frequency === "monthly" ? " per month" : ""} towards <strong className="text-text-primary">{cause}</strong> has been recorded.
          Our team will email payment details and your receipt to {email}.
        </p>
        <button type="button" onClick={() => setSubmitted(false)} className="btn-outline mt-8">
          Make another contribution
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="card-static overflow-hidden">
      <div className="bg-saffron px-6 py-5 text-white sm:px-8">
        <p className="flex items-center gap-2 font-display text-xl font-semibold">
          <HeartHandshake size={20} className="text-gold" /> Make a contribution
        </p>
        <p className="mt-1 text-sm text-white/90">Every rupee directly supports Foundation programmes.</p>
      </div>

      <div className="space-y-7 p-6 sm:p-8">
        <div className="grid grid-cols-2 gap-1 rounded-full bg-warm-cream p-1">
          {(["once", "monthly"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setFrequency(option)}
              className={classNames(
                "flex items-center justify-center gap-2 rounded-full py-2.5 text-sm font-semibold transition",
                frequency === option ? "bg-white text-burgundy shadow" : "text-text-muted"
              )}
            >
              {option === "monthly" && <Repeat size={14} />}
              {option === "once" ? "One-time" : "Monthly"}
            </button>
          ))}
        </div>

        <fieldset>
          <legend className="text-sm font-semibold text-text-primary">Choose an amount</legend>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {donationTiers.map((tier) => (
              <button
                key={tier.amount}
                type="button"
                onClick={() => {
                  setAmount(tier.amount);
                  setCustom("");
                }}
                className={classNames(
                  "rounded-2xl border-2 p-4 text-left transition",
                  !custom && amount === tier.amount
                    ? "border-burgundy bg-burgundy/5"
                    : "border-border hover:border-burgundy/40"
                )}
              >
                <span className="block font-display text-xl font-semibold text-text-primary">
                  {formatCurrency(tier.amount, "INR")}
                </span>
                <span className="block text-xs font-semibold uppercase tracking-[0.12em] text-gold">{tier.title}</span>
              </button>
            ))}
          </div>
          <label className="mt-3 flex items-center gap-2 rounded-2xl border border-border px-4 focus-within:border-burgundy">
            <span className="font-semibold text-text-muted">₹</span>
            <input
              type="number"
              min={100}
              inputMode="numeric"
              value={custom}
              onChange={(event) => setCustom(event.target.value)}
              placeholder="Other amount"
              className="h-12 flex-1 bg-transparent outline-none"
              aria-label="Custom amount"
            />
          </label>
          {selectedTier && (
            <p className="mt-3 rounded-xl bg-sage-light px-4 py-3 text-sm text-sage">{selectedTier.description}</p>
          )}
        </fieldset>

        <fieldset>
          <legend className="text-sm font-semibold text-text-primary">Direct your gift</legend>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {donationCauses.map((item) => (
              <button
                key={item.title}
                type="button"
                onClick={() => setCause(item.title)}
                className={classNames(
                  "flex items-center gap-3 rounded-xl border px-3 py-3 text-left text-sm font-medium transition",
                  cause === item.title ? "border-burgundy bg-burgundy/5 text-burgundy" : "border-border text-text-primary hover:border-burgundy/40"
                )}
              >
                <DynamicIcon name={item.icon} size={18} />
                {item.title}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="grid gap-3 sm:grid-cols-2">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Full name"
            aria-label="Full name"
            className="h-12 rounded-xl border border-border px-4 outline-none focus:border-burgundy"
          />
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Email address"
            aria-label="Email address"
            className="h-12 rounded-xl border border-border px-4 outline-none focus:border-burgundy"
          />
        </div>

        {error && <p className="text-sm font-medium text-red-600">{error}</p>}

        <button type="submit" className="btn-gold w-full py-4 text-base">
          Contribute {finalAmount ? formatCurrency(finalAmount, "INR") : ""}
          {frequency === "monthly" ? " / month" : ""}
        </button>
        <p className="flex items-center justify-center gap-2 text-xs text-text-muted">
          <Lock size={12} /> Secure pledge · Receipt emailed · Tax benefits as applicable
        </p>
      </div>
    </form>
  );
}
