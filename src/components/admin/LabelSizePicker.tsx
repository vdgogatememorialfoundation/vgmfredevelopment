"use client";

import { useState } from "react";
import { LABEL_SIZES, getLabelSize, setLabelSize, type LabelSize } from "@/lib/admin-store";
import { getIntegrations } from "@/lib/integrations";

/** Paper for the Foundation-designed label on this device. Aggregator labels keep the size set in their panel. */
export default function LabelSizePicker() {
  const [size, setSize] = useState<LabelSize>(() => getLabelSize());
  const aggregator = getIntegrations().shipping.labelSource !== "foundation";
  return (
    <select
      aria-label="Label paper size"
      title={aggregator ? "Used when the courier has no label of its own. Courier labels print in the size set in the aggregator panel." : "Paper size for the shipping label"}
      className="rounded-lg border border-border bg-white px-2 py-1.5 text-sm"
      value={size}
      onChange={(event) => {
        const next = event.target.value as LabelSize;
        setSize(next);
        setLabelSize(next);
      }}
    >
      {LABEL_SIZES.map((item) => (
        <option key={item.id} value={item.id}>{item.label}</option>
      ))}
    </select>
  );
}
