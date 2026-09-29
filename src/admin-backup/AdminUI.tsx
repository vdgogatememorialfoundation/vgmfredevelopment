import type { ReactNode } from "react";
import { classNames } from "@/lib/utils";

export function StatCard({
  label,
  value,
  hint,
  tone = "burgundy",
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: "burgundy" | "emerald" | "sky" | "amber" | "red";
}) {
  const tones: Record<string, string> = {
    burgundy: "bg-burgundy/10 text-burgundy",
    emerald: "bg-emerald-50 text-emerald-700",
    sky: "bg-warm-cream text-burgundy",
    amber: "bg-amber-50 text-amber-700",
    red: "bg-red-50 text-red-600",
  };
  return (
    <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">
        {label}
      </p>
      <p className={classNames("mt-2 text-2xl font-bold", tones[tone])}>
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-text-muted">{hint}</p>}
    </div>
  );
}

export function Panel({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-text-primary">{title}</h2>
          {description && (
            <p className="mt-0.5 text-sm text-text-muted">{description}</p>
          )}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

export function Button({
  children,
  onClick,
  type = "button",
  variant = "primary",
  disabled,
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  variant?: "primary" | "outline" | "ghost" | "danger" | "success";
  disabled?: boolean;
  className?: string;
}) {
  const styles: Record<string, string> = {
    primary: "bg-burgundy text-white hover:bg-burgundy-dark",
    outline: "border border-border text-burgundy hover:bg-warm-cream",
    ghost: "text-burgundy hover:bg-warm-cream",
    danger: "bg-red-600 text-white hover:bg-red-700",
    success: "bg-emerald-600 text-white hover:bg-emerald-700",
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={classNames(
        "rounded-lg px-4 py-2 text-sm font-semibold transition",
        styles[variant],
        disabled && "cursor-not-allowed opacity-50",
        className
      )}
    >
      {children}
    </button>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-text-primary">
        {label}
      </span>
      {children}
    </label>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className="input-field" />;
}

export function SelectInput(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className="input-field" />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className="input-field" />;
}

export function StatusBadge({
  status,
  mapping,
}: {
  status: string;
  mapping: Record<string, string>;
}) {
  const tone = mapping[status] ?? "bg-warm-cream text-text-muted";
  return (
    <span
      className={classNames(
        "inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold",
        tone
      )}
    >
      {status}
    </span>
  );
}

export const ORDER_STATUS_TONES: Record<string, string> = {
  Ordered: "bg-burgundy/10 text-burgundy",
  Packed: "bg-amber-50 text-amber-700",
  Shipped: "bg-warm-cream text-burgundy",
  "Out for Delivery": "bg-burgundy/10 text-burgundy",
  Delivered: "bg-emerald-50 text-emerald-700",
  Cancelled: "bg-red-50 text-red-600",
  Processing: "bg-amber-50 text-amber-700",
};

export const ORDER_STATUS_FLOW = [
  "Ordered",
  "Packed",
  "Shipped",
  "Out for Delivery",
  "Delivered",
] as const;

export function EmptyState({ text }: { text: string }) {
  return (
    <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-text-muted">
      {text}
    </p>
  );
}

export function formatINR(amount: number) {
  return `₹${amount.toLocaleString("en-IN")}`;
}