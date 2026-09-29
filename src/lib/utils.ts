export function formatDate(date: string | Date, options?: Intl.DateTimeFormatOptions) {
  return new Date(date).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...options,
  });
}

export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatDateRange(startDate: string, endDate: string) {
  const start = new Date(startDate);
  const end = new Date(endDate);

  const sameYear = start.getFullYear() === end.getFullYear();
  const sameMonth = start.getMonth() === end.getMonth();

  if (start.getTime() === end.getTime()) {
    return formatDate(startDate);
  }

  if (sameYear && sameMonth) {
    return `${start.getDate()}${ordinalSuffix(start.getDate())}-${formatDate(endDate)}`;
  }

  if (sameYear) {
    return `${formatDate(startDate, { day: "numeric", month: "short" })} – ${formatDate(endDate)}`;
  }

  return `${formatDate(startDate)} – ${formatDate(endDate)}`;
}

export function ordinalSuffix(day: number) {
  const suffixes = ["th", "st", "nd", "rd"];
  const value = day % 100;
  return suffixes[(value - 20) % 10] || suffixes[value] || suffixes[0];
}

export function formatCurrency(amount: number, currency = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}

export function daysBetween(from: string, to: string) {
  const ms = new Date(to).getTime() - new Date(from).getTime();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

export function eventDays(startDate: string, endDate: string) {
  return daysBetween(startDate, endDate) + 1;
}

export function isUpcoming(date: string) {
  return new Date(date).getTime() > Date.now();
}

export function classNames(
  ...classes: Array<string | false | null | undefined>
) {
  return classes.filter(Boolean).join(" ");
}

export function truncateText(text: string, length = 160) {
  if (text.length <= length) return text;
  return `${text.slice(0, length).trimEnd()}…`;
}