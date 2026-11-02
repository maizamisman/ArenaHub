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

export type AuditRow = { id: string; at: string; who: string; user_id: string | null; action: string; match_id: string | null; match: string | null; before: string | null; after: string | null; reason: string | null };

/** Audit Log, newest first, filtered by match, user and date (Malaysia time, YYYY-MM-DD). */
export function listAudit(db: DatabaseSync, f: { matchId?: string; userId?: string; from?: string; to?: string; limit?: number } = {}): AuditRow[] {
  const where: string[] = [];
  const args: string[] = [];
  if (f.matchId) { where.push("a.match_id = ?"); args.push(f.matchId); }
  if (f.userId) { where.push("a.user_id = ?"); args.push(f.userId); }
  if (f.from) { where.push("a.at >= ?"); args.push(new Date(`${f.from}T00:00:00+08:00`).toISOString()); }
  if (f.to) { where.push("a.at < ?"); args.push(new Date(Date.parse(`${f.to}T00:00:00+08:00`) + 86_400_000).toISOString()); }
  const rows = db.prepare(
    `SELECT a.id, a.at, COALESCE(u.name, 'System') AS who, a.user_id, a.action, a.match_id, a.before, a.after, a.reason,
            CASE WHEN m.id IS NULL THEN NULL ELSE COALESCE(ta.short_name, 'TBD') || ' vs ' || COALESCE(tb.short_name, 'TBD') || ', ' || s.name END AS match
     FROM audit_log a LEFT JOIN users u ON u.id = a.user_id
     LEFT JOIN matches m ON m.id = a.match_id LEFT JOIN sports s ON s.id = m.sport_id
     LEFT JOIN teams ta ON ta.id = m.team_a LEFT JOIN teams tb ON tb.id = m.team_b
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY a.rowid DESC LIMIT ${Math.min(f.limit ?? 300, 1000)}`,
  ).all(...args) as AuditRow[];
  return rows.map((r) => ({ ...r }));
}
