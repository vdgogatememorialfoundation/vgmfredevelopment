type StoredEvent = {
  id: string;
  at: string;
  source: "shiprocket" | "meta";
  awb?: string;
  orderId?: string;
  status?: string;
  payload: Record<string, unknown>;
};

const MAX = 200;
const events: StoredEvent[] = [];

export function pushWebhook(event: Omit<StoredEvent, "id" | "at"> & { id?: string; at?: string }) {
  const next: StoredEvent = {
    id: event.id ?? `WH${Date.now()}${Math.floor(Math.random() * 90 + 10)}`,
    at: event.at ?? new Date().toISOString(),
    source: event.source,
    awb: event.awb,
    orderId: event.orderId,
    status: event.status,
    payload: event.payload,
  };
  events.unshift(next);
  if (events.length > MAX) events.length = MAX;
  return next;
}

export function listWebhooks(source?: StoredEvent["source"]) {
  return source ? events.filter((event) => event.source === source) : events;
}
