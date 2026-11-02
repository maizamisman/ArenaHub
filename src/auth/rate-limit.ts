import type { DatabaseSync } from "node:sqlite";

/** Number of events recorded in a bucket within the window. */
export function countRecent(db: DatabaseSync, bucket: string, windowMs: number, nowMs = Date.now()): number {
  const row = db.prepare("SELECT COUNT(*) AS n FROM rate_events WHERE bucket = ? AND at_ms > ?").get(bucket, nowMs - windowMs) as { n: number };
  return row.n;
}

export function record(db: DatabaseSync, bucket: string, nowMs = Date.now()): void {
  db.prepare("INSERT INTO rate_events (bucket, at_ms) VALUES (?, ?)").run(bucket, nowMs);
}

export function clear(db: DatabaseSync, bucket: string): void {
  db.prepare("DELETE FROM rate_events WHERE bucket = ?").run(bucket);
}

/** Drops events older than a day so the table stays small. */
export function prune(db: DatabaseSync, nowMs = Date.now()): void {
  db.prepare("DELETE FROM rate_events WHERE at_ms < ?").run(nowMs - 86_400_000);
}
