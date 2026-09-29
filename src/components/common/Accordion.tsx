"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { classNames } from "@/lib/utils";

export interface AccordionItem {
  question: string;
  answer: string;
}

export default function Accordion({
  items,
  defaultOpen = 0,
}: {
  items: AccordionItem[];
  defaultOpen?: number | null;
}) {
  const [open, setOpen] = useState<number | null>(defaultOpen);

  return (
    <div className="space-y-3">
      {items.map((item, index) => {
        const isOpen = open === index;
        const id = `acc-${item.question.replace(/\W+/g, "-").toLowerCase()}`;
        return (
          <div
            key={item.question}
            className={classNames(
              "overflow-hidden rounded-2xl border bg-white transition-all duration-300",
              isOpen ? "border-burgundy/30 shadow-[0_20px_40px_-24px_rgb(15_95_168/0.45)]" : "border-border"
            )}
          >
            <button
              type="button"
              aria-expanded={isOpen}
              aria-controls={id}
              onClick={() => setOpen(isOpen ? null : index)}
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left sm:px-6"
            >
              <span className="font-semibold text-text-primary">{item.question}</span>
              <span
                className={classNames(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition duration-300",
                  isOpen ? "rotate-45 bg-burgundy text-white" : "bg-warm-cream text-burgundy"
                )}
              >
                <Plus size={16} />
              </span>
            </button>
            <div
              id={id}
              className={classNames(
                "grid transition-all duration-300 ease-out",
                isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
              )}
            >
              <div className="overflow-hidden">
                <p className="px-5 pb-5 text-sm leading-7 text-text-muted sm:px-6">{item.answer}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
