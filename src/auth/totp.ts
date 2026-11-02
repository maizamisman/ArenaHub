import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { base32Decode, base32Encode } from "./base32.ts";

const STEP_MS = 30_000;

function hotp(key: Buffer, counter: number): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const h = createHmac("sha1", key).update(msg).digest();
  const off = h[h.length - 1] & 0x0f;
  const bin = ((h[off] & 0x7f) << 24) | (h[off + 1] << 16) | (h[off + 2] << 8) | h[off + 3];
  return String(bin % 1_000_000).padStart(6, "0");
}

/** RFC 6238: SHA-1, 30 second step, 6 digits. */
export function totpNow(secretBase32: string, atMs: number): string {
  return hotp(base32Decode(secretBase32), Math.floor(atMs / STEP_MS));
}

/** Accepts the current code and one step either side, for small clock drift. */
export function verifyTotp(secret: string, code: string, atMs: number): boolean {
  if (!/^\d{6}$/.test(code)) return false;
  const key = base32Decode(secret);
  const counter = Math.floor(atMs / STEP_MS);
  return [-1, 0, 1].some((d) => timingSafeEqual(Buffer.from(hotp(key, counter + d)), Buffer.from(code)));
}

export function newTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

export function otpauthUrl(secret: string, account: string): string {
  return `otpauth://totp/${encodeURIComponent(`ArenaHub:${account}`)}?secret=${secret}&issuer=ArenaHub&algorithm=SHA1&digits=6&period=30`;
}
