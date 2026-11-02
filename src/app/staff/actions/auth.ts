"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { login, completeMfa, changePassword, endSession, totpSecretFor, sessionUserFromId } from "@/auth/session";
import { getSessionId, setSessionCookie, clearSessionCookie, getSessionUser } from "@/auth/request";
import { HOME } from "@/auth/guard";

export type FormState = { error?: string; email?: string };
const SETUP_COOKIE = "ah_totp_setup";

export async function loginAction(_: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get("email") ?? "");
  const r = login(email, String(form.get("password") ?? ""));
  if (!r.ok) return { error: r.error, email };
  await setSessionCookie(r.sessionId);
  if (r.needsMfa) redirect("/staff/2fa");
  if (r.mustChange) redirect("/staff/change-password");
  redirect(HOME[sessionUserFromId(r.sessionId)!.role]);
}

/** Keeps the first-time setup secret stable across page reloads until a code confirms it. */
export async function holdSetupSecret(secret: string): Promise<void> {
  const jar = await cookies();
  if (!jar.get(SETUP_COOKIE)) jar.set(SETUP_COOKIE, secret, { httpOnly: true, sameSite: "strict", path: "/staff", maxAge: 900 });
}

export async function mfaAction(_: FormState, form: FormData): Promise<FormState> {
  const sid = await getSessionId();
  const user = sessionUserFromId(sid);
  if (!sid || !user) redirect("/staff/login");
  const jar = await cookies();
  const setup = totpSecretFor(user.id) ? undefined : jar.get(SETUP_COOKIE)?.value;
  if (!completeMfa(sid, String(form.get("code") ?? ""), Date.now(), setup)) {
    return { error: "That code is not right. Check the time on your phone and try the newest code." };
  }
  jar.delete(SETUP_COOKIE);
  redirect(user.mustChange ? "/staff/change-password" : HOME[user.role]);
}

export async function changePasswordAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await getSessionUser();
  if (!user) redirect("/staff/login");
  const next = String(form.get("next") ?? "");
  if (next !== String(form.get("confirm") ?? "")) return { error: "The two new passwords do not match." };
  const r = changePassword(user.id, String(form.get("current") ?? ""), next);
  if (!r.ok) return { error: r.error };
  redirect(HOME[user.role]);
}

export async function logoutAction(): Promise<void> {
  const sid = await getSessionId();
  if (sid) endSession(sid);
  await clearSessionCookie();
  redirect("/staff/login");
}
