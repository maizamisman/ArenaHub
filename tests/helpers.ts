import type { DatabaseSync } from "node:sqlite";
import { openDb, setDb } from "@/data/db";
import { seed } from "@/data/seed";
import type { SessionUser } from "@/domain/types";

export const SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

/** A fresh seeded database, installed as the shared connection. */
export function freshDb(file = ":memory:"): DatabaseSync {
  const db = openDb(file);
  seed(db, { adminPassword: "admin-pass-123", picPassword: "pic-pass-1234", adminTotpSecret: SECRET, copyPhotos: false });
  setDb(db);
  return db;
}

export function userByEmail(db: DatabaseSync, email: string): SessionUser {
  const u = db.prepare("SELECT id, name, email, role, active FROM users WHERE email = ?").get(email) as { id: string; name: string; email: string; role: "admin" | "pic"; active: number };
  return { ...u, active: !!u.active, mfaOk: true };
}

/** Finds a seeded match by its two team short names and round. */
export function matchId(db: DatabaseSync, a: string | null, b: string | null, round: string): string {
  const r = db.prepare(
    `SELECT m.id FROM matches m LEFT JOIN teams ta ON ta.id = m.team_a LEFT JOIN teams tb ON tb.id = m.team_b
     WHERE m.round = ? AND ta.short_name IS ? AND tb.short_name IS ?`,
  ).get(round, a, b) as { id: string } | undefined;
  if (!r) throw new Error(`no match ${a} v ${b} ${round}`);
  return r.id;
}
