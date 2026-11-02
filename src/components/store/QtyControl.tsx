"use client";

import { useEffect, useState } from "react";

export default function QtyControl({
  value,
  max,
  onChange,
}: {
  value: number;
  max: number;
  onChange: (quantity: number) => void;
}) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  const ceiling = Math.max(1, max);

  const commit = (raw: string) => {
    const digits = raw.replace(/\D/g, "");
    if (!digits) {
      onChange(0);
      return;
    }
    onChange(Math.min(ceiling, Number(digits)));
  };

  return (
    <div className="flex items-center rounded-lg border border-border">
      <button
        type="button"
        aria-label="Decrease quantity"
        onClick={() => onChange(value - 1)}
        className="flex h-9 w-9 items-center justify-center text-base transition hover:text-burgundy"
      >
        −
      </button>
      <input
        aria-label="Quantity"
        inputMode="numeric"
        className="w-12 border-x border-border bg-transparent text-center text-sm font-semibold tabular-nums outline-none"
        value={text}
        onChange={(event) => setText(event.target.value.replace(/\D/g, "").slice(0, 3))}
        onBlur={() => commit(text)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commit(text);
          }
        }}
      />
      <button
        type="button"
        aria-label="Increase quantity"
        disabled={value >= ceiling}
        onClick={() => onChange(Math.min(ceiling, value + 1))}
        className="flex h-9 w-9 items-center justify-center text-base transition hover:text-burgundy disabled:opacity-40"
      >
        +
      </button>
    </div>
  );
}
