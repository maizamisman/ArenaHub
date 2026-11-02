import type { DatabaseSync } from "node:sqlite";
import { getDb } from "./db.ts";
import { DEFAULT_SETTINGS } from "./seed.ts";

export type Settings = typeof DEFAULT_SETTINGS;
export type ModuleKey = keyof Settings["modules"];

/** All settings, with defaults for anything missing. */
export function getSettings(db: DatabaseSync = getDb()): Settings {
  const rows = db.prepare("SELECT key, value FROM settings").all() as { key: string; value: string }[];
  const out: Record<string, unknown> = { ...DEFAULT_SETTINGS, modules: { ...DEFAULT_SETTINGS.modules } };
  for (const r of rows) {
    if (!(r.key in DEFAULT_SETTINGS)) continue;
    try { out[r.key] = JSON.parse(r.value); } catch { /* keep default */ }
  }
  out.modules = { ...DEFAULT_SETTINGS.modules, ...(out.modules as object) };
  return out as Settings;
}

export function moduleOn(key: ModuleKey, db: DatabaseSync = getDb()): boolean {
  return getSettings(db).modules[key] !== false;
}
