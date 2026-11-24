export const FOUNDATION_NAME = "Vaidya Gogate Memorial Foundation";

/** Customers see the Foundation's full name, never "Admin", "VGMF" or "Admin VGMF". */
export function publicStaffName(name?: string) {
  const value = (name ?? "").trim();
  if (!value || /\bvgmf\b/i.test(value) || /^(admin|administrator|co-?admin)$/i.test(value)) return FOUNDATION_NAME;
  return value;
}

/** Older chat lines were written with "Admin VGMF" or "VGMF" in the text. */
export function publicStaffText(text: string) {
  return text.replace(/\b(?:Admin(?:istrator)?\s+)?VGMF(?:\s+Admin)?\b/g, FOUNDATION_NAME);
}
