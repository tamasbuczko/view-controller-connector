import { randomBytes } from "node:crypto";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function sessionCode(length = 6): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += CODE_ALPHABET[bytes[i]! % CODE_ALPHABET.length];
  }
  return out;
}

export function token(): string {
  return randomBytes(24).toString("base64url");
}

export function peerId(): string {
  return `p_${randomBytes(8).toString("hex")}`;
}

export function sessionId(): string {
  return `s_${randomBytes(10).toString("hex")}`;
}
