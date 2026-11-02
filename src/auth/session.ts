import { getDb, uuid, nowIso } from "../data/db.ts";
import { hashPassword, verifyPassword } from "./password.ts";
import { verifyTotp } from "./totp.ts";
import { countRecent, record, clear, prune } from "./rate-limit.ts";
import type { Role, SessionUser } from "../domain/types.ts";

export const SESSION_COOKIE = "ah_session";
export const SESSION_HOURS = 12;
const LOCK_WINDOW_MS = 10 * 60_000;
const MAX_FAILURES = 5;
const BAD_LOGIN = "Email or password is incorrect.";

type UserRow = {
  id: string; email: string; name: string; role: Role; password_hash: string;
  must_change_password: number; totp_secret: string | null; active: number;
};

export type LoginResult =
  | { ok: true; sessionId: string; needsMfa: boolean; mustChange: boolean }
  | { ok: false; error: string };

export function login(email: string, pw: string, nowMs = Date.now()): LoginResult {
  const db = getDb();
  const key = `login:${email.trim().toLowerCase()}`;
  prune(db, nowMs);
  if (countRecent(db, key, LOCK_WINDOW_MS, nowMs) >= MAX_FAILURES) {
    return { ok: false, error: "Too many attempts. Try again in 10 minutes." };
  }
  const u = db.prepare("SELECT * FROM users WHERE email = ?").get(email.trim()) as UserRow | undefined;
  // Hash even when the user is missing so response time doesn't reveal which emails exist.
  const ok = u ? verifyPassword(pw, u.password_hash) : (verifyPassword(pw, DUMMY_HASH), false);
  if (!u || !ok || !u.active) {
    record(db, key, nowMs);
    return { ok: false, error: BAD_LOGIN };
  }
  clear(db, key);
  const sessionId = createSession(u.id, u.role !== "admin", nowMs);
  return { ok: true, sessionId, needsMfa: u.role === "admin", mustChange: !!u.must_change_password };
}

const DUMMY_HASH = hashPassword("not-a-real-password");

export function createSession(userId: string, mfaOk: boolean, nowMs = Date.now()): string {
  const id = uuid() + uuid().replace(/-/g, "");
  const expires = new Date(nowMs + SESSION_HOURS * 3_600_000).toISOString();
  getDb().prepare("INSERT INTO sessions (id, user_id, expires_at, mfa_ok) VALUES (?,?,?,?)").run(id, userId, expires, mfaOk ? 1 : 0);
  return id;
}

/** The signed-in user, re-checking active and expiry on every call. */
export function sessionUserFromId(sessionId: string | undefined | null, nowMs = Date.now()): SessionUser | null {
  if (!sessionId) return null;
  const row = getDb().prepare(
    `SELECT u.id, u.name, u.email, u.role, u.active, u.must_change_password, s.mfa_ok, s.expires_at
     FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ?`,
  ).get(sessionId) as (UserRow & { mfa_ok: number; expires_at: string }) | undefined;
  if (!row || !row.active || Date.parse(row.expires_at) <= nowMs) return null;
  return {
    id: row.id, name: row.name, email: row.email, role: row.role, active: true,
    mustChange: !!row.must_change_password, mfaOk: !!row.mfa_ok,
  };
}

/** The Admin's TOTP secret, or null when 2FA has not been set up yet. */
export function totpSecretFor(userId: string): string | null {
  const r = getDb().prepare("SELECT totp_secret FROM users WHERE id = ?").get(userId) as { totp_secret: string | null } | undefined;
  return r?.totp_secret ?? null;
}

/** Checks a code and marks the session as past 2FA. `setupSecret` confirms first-time setup. */
export function completeMfa(sessionId: string, code: string, nowMs = Date.now(), setupSecret?: string): boolean {
  const db = getDb();
  const u = sessionUserFromId(sessionId, nowMs);
  if (!u) return false;
  const secret = totpSecretFor(u.id) ?? setupSecret;
  if (!secret || !verifyTotp(secret, code.trim(), nowMs)) return false;
  if (!totpSecretFor(u.id)) db.prepare("UPDATE users SET totp_secret = ? WHERE id = ?").run(secret, u.id);
  db.prepare("UPDATE sessions SET mfa_ok = 1 WHERE id = ?").run(sessionId);
  return true;
}

export function changePassword(userId: string, current: string, next: string): { ok: true } | { ok: false; error: string } {
  const db = getDb();
  const u = db.prepare("SELECT password_hash FROM users WHERE id = ?").get(userId) as { password_hash: string } | undefined;
  if (!u || !verifyPassword(current, u.password_hash)) return { ok: false, error: "Your current password is incorrect." };
  if (next.length < 10) return { ok: false, error: "Use at least 10 characters." };
  if (next === current) return { ok: false, error: "Choose a password different from the current one." };
  db.prepare("UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?").run(hashPassword(next), userId);
  db.prepare("INSERT INTO audit_log (id, at, user_id, action) VALUES (?,?,?,?)").run(uuid(), nowIso(), userId, "password_changed");
  return { ok: true };
}

export function endSession(sessionId: string): void {
  getDb().prepare("DELETE FROM sessions WHERE id = ?").run(sessionId);
}
