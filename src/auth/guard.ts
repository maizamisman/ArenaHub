import type { SessionUser } from "../domain/types.ts";

export type Need = "admin" | "pic" | "staff";
export type Access = "ok" | "login" | "mfa" | "change-password" | "forbidden";

/** Pure access decision, so it can be tested without a request. */
export function checkAccess(user: SessionUser | null, need: Need): Access {
  if (!user || !user.active) return "login";
  if (user.role === "admin" && !user.mfaOk) return "mfa";
  if (user.mustChange) return "change-password";
  if (need === "staff" || need === user.role) return "ok";
  return "forbidden";
}

export const HOME: Record<SessionUser["role"], string> = { admin: "/staff/admin", pic: "/staff/pic" };

/** Changing a password needs a full sign-in: the Admin must have passed 2FA first. */
export function canChangePassword(user: SessionUser | null): boolean {
  const a = checkAccess(user, "staff");
  return a === "ok" || a === "change-password";
}
