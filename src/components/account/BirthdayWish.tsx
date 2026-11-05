"use client";

import { indiaToday } from "@/lib/festival-themes";
import { isBirthday } from "@/lib/site-extras";
import { useSiteText } from "@/lib/use-site-text";

export default function BirthdayWish({ firstName, birthDate }: { firstName: string; birthDate?: string }) {
  const birthday = useSiteText().birthday;
  if (!birthday?.enabled || !isBirthday(birthDate, indiaToday())) return null;
  return (
    <div className="rounded-2xl border border-gold/50 bg-gradient-to-r from-gold/15 via-white to-gold/15 p-5 text-center" role="status">
      <p className="text-2xl" aria-hidden>🎂</p>
      <p className="mt-1 font-serif text-xl text-ink">Happy birthday, {firstName}!</p>
      <p className="mt-1 text-sm text-text-muted">{birthday.message.replace(/\{name\}/g, firstName)}</p>
    </div>
  );
}
