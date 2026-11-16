"use client";

import { useState } from "react";
import { LABEL_SIZES, getLabelColour, getLabelHidePhone, getLabelHideStorePhone, getLabelSize, setLabelColour, setLabelHidePhone, setLabelHideStorePhone, setLabelSize, type LabelColour, type LabelSize } from "@/lib/admin-store";
import { getIntegrations } from "@/lib/integrations";

/** Paper and ink for the Foundation-designed label on this device. Aggregator labels keep the size set in their panel. */
export default function LabelSizePicker() {
  const [size, setSize] = useState<LabelSize>(() => getLabelSize());
  const [colour, setColour] = useState<LabelColour>(() => getLabelColour());
  const [hidePhone, setHidePhone] = useState(() => getLabelHidePhone());
  const [hideStorePhone, setHideStorePhone] = useState(() => getLabelHideStorePhone());
  const aggregator = getIntegrations().shipping.labelSource !== "foundation";
  return (
    <>
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
      <select
        aria-label="Label print colour"
        className="rounded-lg border border-border bg-white px-2 py-1.5 text-sm"
        value={colour}
        onChange={(event) => {
          const next = event.target.value as LabelColour;
          setColour(next);
          setLabelColour(next);
        }}
      >
        <option value="bw">Black &amp; white</option>
        <option value="colour">Colour</option>
      </select>
      <label className="flex items-center gap-1.5 text-sm" title="Leaves the customer's mobile number off the label">
        <input
          type="checkbox"
          checked={hidePhone}
          onChange={(event) => {
            setHidePhone(event.target.checked);
            setLabelHidePhone(event.target.checked);
          }}
        />
        Hide customer ph.
      </label>
      <label className="flex items-center gap-1.5 text-sm" title="Leaves the store / sender phone off the label">
        <input
          type="checkbox"
          checked={hideStorePhone}
          onChange={(event) => {
            setHideStorePhone(event.target.checked);
            setLabelHideStorePhone(event.target.checked);
          }}
        />
        Hide store ph.
      </label>
    </>
  );
}
