"use client";

import { useRef, useState } from "react";
import { classNames } from "@/lib/utils";

interface OtpInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  ariaLabel?: string;
}

export default function OtpInput({
  length = 6,
  value,
  onChange,
  ariaLabel = "One-time password",
}: OtpInputProps) {
  const [digits, setDigits] = useState<string[]>(() =>
    Array.from({ length }, (_, index) => (value[index] || "").toString())
  );
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  const update = (next: string[]) => {
    setDigits(next);
    onChange(next.join(""));
  };

  const handleChange = (
    index: number,
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const raw = event.target.value;
    const digit = raw.replace(/\D/g, "").slice(-1);

    const next = [...digits];
    next[index] = digit;
    update(next);

    if (digit && index < length - 1) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (
    index: number,
    event: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (event.key === "Backspace") {
      if (digits[index]) {
        const next = [...digits];
        next[index] = "";
        update(next);
      } else if (index > 0) {
        inputsRef.current[index - 1]?.focus();
      }
    }

    if (event.key === "ArrowLeft" && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }

    if (event.key === "ArrowRight" && index < length - 1) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "");
    if (!pasted) return;

    event.preventDefault();

    const next = Array.from({ length }, (_, index) => pasted[index] || "");
    update(next);

    const focusIndex = Math.min(pasted.length, length - 1);
    inputsRef.current[focusIndex]?.focus();
  };

  return (
    <div
      className="flex justify-center gap-2 sm:gap-3"
      role="group"
      aria-label={ariaLabel}
    >
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(element) => {
            inputsRef.current[index] = element;
          }}
          type="text"
          inputMode="numeric"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          maxLength={2}
          value={digit}
          aria-label={`Digit ${index + 1}`}
          onChange={(event) => handleChange(index, event)}
          onKeyDown={(event) => handleKeyDown(index, event)}
          onPaste={handlePaste}
          className={classNames(
            "h-14 w-11 rounded-xl border bg-white text-center text-2xl font-semibold text-text-primary outline-none transition sm:h-16 sm:w-14",
            digit
              ? "border-burgundy ring-2 ring-burgundy/10"
              : "border-border focus:border-burgundy focus:ring-2 focus:ring-burgundy/10"
          )}
        />
      ))}
    </div>
  );
}