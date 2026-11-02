import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, SESSION_HOURS, sessionUserFromId } from "./session";
import { checkAccess, HOME, type Need } from "./guard";
import type { SessionUser } from "@/domain/types";

/** Reads the ah_session cookie and re-checks the account on every call. */
export async function getSessionUser(): Promise<SessionUser | null> {
  return sessionUserFromId((await cookies()).get(SESSION_COOKIE)?.value);
}

export async function getSessionId(): Promise<string | undefined> {
  return (await cookies()).get(SESSION_COOKIE)?.value;
}

/** The signed-in user with the needed role, or a redirect to the right step. */
export async function requireRole(need: Need): Promise<SessionUser> {
  const user = await getSessionUser();
  const access = checkAccess(user, need);
  if (access === "ok") return user!;
  if (access === "login") redirect("/staff/login");
  if (access === "mfa") redirect("/staff/2fa");
  if (access === "change-password") redirect("/staff/change-password");
  redirect(HOME[user!.role]);
}

export async function setSessionCookie(id: string): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, id, { httpOnly: true, sameSite: "lax", path: "/", maxAge: SESSION_HOURS * 3600 });
}

export async function clearSessionCookie(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}
