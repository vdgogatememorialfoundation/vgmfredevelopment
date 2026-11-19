"use client";

import { useSyncExternalStore, useState } from "react";
import { ORDER_ALERTS_KEY } from "@/lib/commerce-sync";

function readState() {
  if (typeof Notification === "undefined") return "unsupported";
  if (Notification.permission === "denied") return "denied";
  if (Notification.permission === "granted" && window.localStorage.getItem(ORDER_ALERTS_KEY) !== "off") return "on";
  return "off";
}

export default function OrderAlertsToggle() {
  const [tick, setTick] = useState(0);
  const state = useSyncExternalStore(
    () => () => undefined,
    () => `${readState()}|${tick}`,
    () => "unsupported|0"
  ).split("|")[0];
  if (state === "unsupported") return null;

  const turnOn = async () => {
    const permission = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
    if (permission === "granted") {
      window.localStorage.setItem(ORDER_ALERTS_KEY, "on");
      new Notification("Vaidya Gogate Memorial Foundation", { body: "Order alerts are on. We will notify you at every step.", icon: "/favicon.ico" });
    }
    setTick((value) => value + 1);
  };
  const turnOff = () => {
    window.localStorage.setItem(ORDER_ALERTS_KEY, "off");
    setTick((value) => value + 1);
  };

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-white px-4 py-3 text-sm">
      <span className="text-text-primary">
        <b>Order alerts</b>{" "}
        {state === "on"
          ? "are on — you get a browser notification when an order is packed, shipped, delivered or refunded."
          : state === "denied"
            ? "are blocked in this browser. Allow notifications for this site in the browser settings."
            : "— get a browser notification at every step of your orders. Order emails are sent either way."}
      </span>
      {state === "on" ? (
        <button type="button" onClick={turnOff} className="btn-outline px-3 py-1.5 text-xs">Turn off</button>
      ) : state === "off" ? (
        <button type="button" onClick={() => void turnOn()} className="btn-primary px-3 py-1.5 text-xs">Turn on notifications</button>
      ) : null}
    </div>
  );
}
