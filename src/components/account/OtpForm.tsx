"use client";

import { useEffect, useState } from "react";
import OtpInput from "@/components/common/OtpInput";

interface OtpFormProps {
  title: string;
  description: string;
  onSubmit: (otp: string) => void;
  onBack: () => void;
  onResend: () => void;
}

const RESEND_SECONDS = 30;

export default function OtpForm({
  title,
  description,
  onSubmit,
  onBack,
  onResend,
}: OtpFormProps) {
  const [otp, setOtp] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);
  const countdownDone = secondsLeft === 0;

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft((current) => {
        if (current <= 1) {
          clearInterval(timer);
          return 0;
        }
        return current - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [countdownDone]);

  const handleResend = () => {
    if (secondsLeft > 0) return;
    setSecondsLeft(RESEND_SECONDS);
    onResend();
  };

  return (
    <div>
      <button
        type="button"
        onClick={onBack}
        className="mb-6 inline-flex text-sm font-medium text-text-muted transition hover:text-burgundy"
      >
        ← Go back
      </button>

      <div className="mb-8">
        <p className="mb-2 text-sm font-semibold uppercase tracking-[0.18em] text-burgundy">
          Verification
        </p>

        <h2 className="text-3xl font-bold text-text-primary sm:text-4xl">
          {title}
        </h2>

        <p className="mt-3 text-sm leading-6 text-text-muted">
          {description}
        </p>
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (otp.length === 6) onSubmit(otp);
        }}
        noValidate
      >
        <OtpInput
          length={6}
          value={otp}
          onChange={setOtp}
          ariaLabel={`OTP for ${title}`}
        />

        <button
          type="submit"
          disabled={otp.length !== 6}
          className="btn-primary mt-8 w-full disabled:cursor-not-allowed disabled:opacity-40"
        >
          Verify OTP
        </button>

        <button
          type="button"
          onClick={handleResend}
          disabled={secondsLeft > 0}
          className="mt-4 w-full text-center text-sm font-semibold text-burgundy disabled:text-text-muted"
        >
          {secondsLeft > 0
            ? `Resend OTP in ${secondsLeft}s`
            : "Resend OTP"}
        </button>
      </form>
    </div>
  );
}