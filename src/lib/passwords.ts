const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

export function generatePassword(length = 10) {
  let value = "";
  const bytes = typeof crypto !== "undefined" && crypto.getRandomValues ? crypto.getRandomValues(new Uint32Array(length)) : null;
  for (let i = 0; i < length; i += 1) {
    const index = bytes ? bytes[i] % alphabet.length : Math.floor(Math.random() * alphabet.length);
    value += alphabet[index];
  }
  return value;
}
