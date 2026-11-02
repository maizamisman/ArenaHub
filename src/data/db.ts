import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

export const DATA_DIR = path.join(/* turbopackIgnore: true */ process.cwd(), "data");
export const UPLOAD_DIR = path.join(DATA_DIR, "uploads");

/** Where uploaded photos live; tests point ARENAHUB_UPLOADS at a temp folder. */
export function uploadDir(): string {
  return process.env.ARENAHUB_UPLOADS ? path.resolve(process.env.ARENAHUB_UPLOADS) : UPLOAD_DIR;
}
const SCHEMA = path.join(/* turbopackIgnore: true */ process.cwd(), "src", "data", "schema.sql");

export function defaultDbFile(): string {
  return process.env.ARENAHUB_DB ? path.resolve(process.env.ARENAHUB_DB) : path.join(DATA_DIR, "arenahub.db");
}

export function openDb(file: string = defaultDbFile()): DatabaseSync {
  if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec("PRAGMA foreign_keys=ON");
  db.exec("PRAGMA busy_timeout=5000");
  if (file !== ":memory:") db.exec("PRAGMA journal_mode=WAL");
  db.exec(fs.readFileSync(SCHEMA, "utf8"));
  return db;
}

// One shared connection per server process. Tests swap it with setDb.
const g = globalThis as unknown as { __arenahubDb?: DatabaseSync };

export function getDb(): DatabaseSync {
  if (!g.__arenahubDb) g.__arenahubDb = openDb();
  return g.__arenahubDb;
}

export function setDb(db: DatabaseSync): void {
  g.__arenahubDb = db;
}

/** Runs fn inside BEGIN IMMEDIATE; rolls back if it throws. */
export function tx<T>(db: DatabaseSync, fn: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try {
    const out = fn();
    db.exec("COMMIT");
    return out;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

/** node:sqlite rows have a null prototype; copy them so they can cross to client components. */
export function plain<T>(rows: unknown[]): T[] {
  return rows.map((r) => ({ ...(r as object) }) as T);
}

export const uuid = () => crypto.randomUUID();
export const nowIso = () => new Date().toISOString();
