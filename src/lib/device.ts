import { createHash, randomBytes } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";

export const DEVICE_COOKIE = "ah_device";

/** Anonymous device id from the ah_device cookie (made once), stored only as a hash. */
export function deviceFromRequest(req: NextRequest): { hash: string; newId?: string } {
  const existing = req.cookies.get(DEVICE_COOKIE)?.value;
  const id = existing && /^[a-f0-9]{32}$/.test(existing) ? existing : randomBytes(16).toString("hex");
  return { hash: hashDevice(id), newId: id === existing ? undefined : id };
}

export const deviceHash = (req: NextRequest) => deviceFromRequest(req).hash;

export function hashDevice(id: string): string {
  return createHash("sha256").update(`arenahub:${id}`).digest("hex").slice(0, 32);
}

export function withDeviceCookie<T extends NextResponse>(res: T, newId?: string): T {
  if (newId) res.cookies.set(DEVICE_COOKIE, newId, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
  return res;
}

export function clientIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "local";
}
