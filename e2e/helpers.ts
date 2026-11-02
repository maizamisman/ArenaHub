import { expect, type APIRequestContext, type Page } from "@playwright/test";
import { createHmac } from "node:crypto";

export const PIC_PASSWORD = "ArenaHub-Pic-2027";
export const NEW_PIC_PASSWORD = "Aina-new-password-2027";
export const ADMIN_PASSWORD = "ArenaHub-Admin-2027";
export const TOTP_SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

export async function resetDb(request: APIRequestContext) {
  const r = await request.post("/api/test/reset");
  expect(r.ok()).toBe(true);
}

function base32(s: string): Buffer {
  const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0, v = 0;
  const out: number[] = [];
  for (const c of s) { v = (v << 5) | A.indexOf(c); bits += 5; if (bits >= 8) { out.push((v >>> (bits - 8)) & 255); bits -= 8; } }
  return Buffer.from(out);
}

/** The current authenticator code for the seeded Admin secret (RFC 6238). */
export function totp(secret = TOTP_SECRET, at = Date.now()): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(Math.floor(at / 30_000)));
  const h = createHmac("sha1", base32(secret)).update(msg).digest();
  const o = h[h.length - 1] & 15;
  return String((((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3]) % 1_000_000).padStart(6, "0");
}

export async function signIn(page: Page, email: string, password: string) {
  await page.goto("/staff/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

/** Signs in as Aina, changing the temporary password the first time. */
export async function signInAina(page: Page) {
  await signIn(page, "aina@arenahub.my", PIC_PASSWORD);
  await page.waitForURL(/change-password|staff\/pic/);
  if (page.url().includes("change-password")) {
    await page.getByLabel("Current password").fill(PIC_PASSWORD);
    await page.getByLabel("New password").fill(NEW_PIC_PASSWORD);
    await page.getByLabel("Repeat new password").fill(NEW_PIC_PASSWORD);
    await page.getByRole("button", { name: "Save password" }).click();
  }
  await page.waitForURL("**/staff/pic");
}

export async function signInAdmin(page: Page) {
  await signIn(page, "admin@arenahub.my", ADMIN_PASSWORD);
  await page.waitForURL("**/staff/2fa");
  await page.getByLabel("6-digit code").fill(totp());
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForURL("**/staff/admin");
}
