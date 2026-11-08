import type { SupportTicket } from "@/types";

type Reply = SupportTicket["responses"][number];

const replyKey = (reply: Reply) => `${reply.at}|${reply.from}|${reply.text}`;
const stamp = (ticket: SupportTicket) => Date.parse(ticket.updatedAt || ticket.createdAt) || 0;

/** Combines two copies of one ticket: every reply from both, other fields from the newer copy. */
export function mergeTickets(current: SupportTicket | undefined, incoming: SupportTicket): SupportTicket {
  if (!current) return { ...incoming, responses: [...(incoming.responses ?? [])] };
  const newer = stamp(incoming) >= stamp(current) ? incoming : current;
  const older = newer === incoming ? current : incoming;
  const replies = new Map<string, Reply>();
  for (const reply of [...(current.responses ?? []), ...(incoming.responses ?? [])]) replies.set(replyKey(reply), reply);
  const responses = [...replies.values()].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  const updatedAt = [current.updatedAt, incoming.updatedAt, ...responses.map((reply) => reply.at)].filter(Boolean).sort().pop() || newer.updatedAt;
  return { ...older, ...newer, responses, updatedAt };
}

export function mergeTicketLists(local: SupportTicket[], remote: SupportTicket[]) {
  const byId = new Map(local.map((ticket) => [ticket.id, ticket]));
  for (const ticket of remote) byId.set(ticket.id, mergeTickets(byId.get(ticket.id), ticket));
  return [...byId.values()];
}
