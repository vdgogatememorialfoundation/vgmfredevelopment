import { mergeTicketLists } from "@/lib/ticket-merge";
import type { SupportTicket } from "@/types";

const KEY = "vgmf_tickets";

/** Sends one ticket to the shared server store so the customer, the support desk and the app see the same thread. */
export function pushTicket(ticket?: SupportTicket) {
  if (!ticket || typeof window === "undefined") return;
  void fetch("/api/support/tickets", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ticket }),
  }).catch(() => undefined);
}

/** Pulls the latest tickets and replies from the server into this browser. */
export async function pullTickets(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  try {
    const response = await fetch("/api/support/tickets", { cache: "no-store" });
    if (!response.ok) return false;
    const data = (await response.json()) as { tickets?: SupportTicket[] };
    if (!Array.isArray(data.tickets)) return false;
    const before = window.localStorage.getItem(KEY) || "[]";
    const local = JSON.parse(before) as SupportTicket[];
    const next = JSON.stringify(mergeTicketLists(local, data.tickets));
    if (next !== before) {
      window.localStorage.setItem(KEY, next);
      window.dispatchEvent(new Event("vgmf-cms"));
    }
    const remote = new Set(data.tickets.map((ticket) => ticket.id));
    for (const ticket of local) if (!remote.has(ticket.id)) pushTicket(ticket);
    return true;
  } catch {
    return false;
  }
}
