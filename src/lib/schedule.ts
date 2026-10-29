export type Schedulable = {
  publishAt?: string;
  unpublishAt?: string;
};

export function isPublishedNow(item: Schedulable, now = Date.now()) {
  if (item.publishAt) {
    const at = Date.parse(item.publishAt);
    if (Number.isFinite(at) && at > now) return false;
  }
  if (item.unpublishAt) {
    const at = Date.parse(item.unpublishAt);
    if (Number.isFinite(at) && at <= now) return false;
  }
  return true;
}

export function toDatetimeLocal(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value.slice(0, 16);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function fromDatetimeLocal(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Date.parse(trimmed);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : trimmed;
}

export function formatCountdown(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const parts: string[] = [];
  if (days) parts.push(`${days}d`);
  parts.push(`${hours}h`, `${minutes}m`);
  if (!days) parts.push(`${seconds}s`);
  return { days, hours, minutes, seconds, label: parts.join(" "), expired: ms <= 0 };
}
