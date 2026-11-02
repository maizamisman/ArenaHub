import { describe, it, expect } from "vitest";
import { openDb } from "@/data/db";
import { seed } from "@/data/seed";

const TABLES = [
  "users", "sessions", "settings", "sports", "medal_rules", "teams", "courts",
  "matches", "match_events", "bracket_slots", "medal_results", "assignments",
  "photos", "photo_likes", "announcements", "audit_log", "request_ids",
];

describe("database", () => {
  it("opens a fresh database with every table", () => {
    const db = openDb(":memory:");
    const rows = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[];
    const names = rows.map((r) => r.name);
    for (const t of TABLES) expect(names).toContain(t);
    expect(db.prepare("PRAGMA foreign_keys").get()).toEqual({ foreign_keys: 1 });
  });

  it("seed creates one admin, three PICs and the sample matches", () => {
    const db = openDb(":memory:");
    seed(db, { adminPassword: "admin-pass-123", picPassword: "pic-pass-1234", copyPhotos: false });
    const count = (sql: string) => (db.prepare(sql).get() as { n: number }).n;
    expect(count("SELECT COUNT(*) n FROM users WHERE role='admin'")).toBe(1);
    expect(count("SELECT COUNT(*) n FROM users WHERE role='pic'")).toBe(3);
    expect(count("SELECT COUNT(*) n FROM matches")).toBe(23);
    expect(count("SELECT COUNT(*) n FROM teams")).toBe(8);
    expect(count("SELECT COUNT(*) n FROM courts")).toBe(4);
  });
});
