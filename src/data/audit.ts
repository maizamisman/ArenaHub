import type { DatabaseSync } from "node:sqlite";
import { uuid, nowIso } from "./db.ts";

export type AuditEntry = {
  userId: string | null;
  action: string;
  matchId?: string | null;
  before?: unknown;
  after?: unknown;
  reason?: string | null;
};

/** Appends one audit row. Call inside the same transaction as the change it records. */
export function writeAudit(db: DatabaseSync, e: AuditEntry): string {
  const id = uuid();
  db.prepare("INSERT INTO audit_log (id, at, user_id, action, match_id, before, after, reason) VALUES (?,?,?,?,?,?,?,?)").run(
    id, nowIso(), e.userId, e.action, e.matchId ?? null,
    e.before === undefined ? null : JSON.stringify(e.before),
    e.after === undefined ? null : JSON.stringify(e.after),
    e.reason ?? null,
  );
  return id;
}

/** Global counter the public pages poll; bumped by every change they should see. */
export function bumpLive(db: DatabaseSync): void {
  db.prepare(
    `INSERT INTO settings (key, value) VALUES ('live_version', '1')
     ON CONFLICT(key) DO UPDATE SET value = CAST(value AS INTEGER) + 1`,
  ).run();
}

export function liveVersion(db: DatabaseSync): number {
  const r = db.prepare("SELECT value FROM settings WHERE key = 'live_version'").get() as { value: string } | undefined;
  return r ? Number(r.value) : 0;
}
