import type { DatabaseSync } from "node:sqlite";
import { getDb, tx } from "./db.ts";
import { writeAudit, bumpLive } from "./audit.ts";
import { requireAdmin, RuleError } from "./matches.ts";
import type { SessionUser } from "../domain/types.ts";
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

const HEX = /^#[0-9a-fA-F]{6}$/;
const SECTIONS = ["live", "standings", "schedule", "photos"];

/** Saves part of the Screen Configuration. Admin only; audited. */
export function saveSettings(user: SessionUser, patch: Partial<Settings>): Settings {
  const db = getDb();
  return tx(db, () => {
    const me = requireAdmin(db, user);
    const cur = getSettings(db);
    const next: Settings = { ...cur, ...patch, modules: { ...cur.modules, ...(patch.modules ?? {}) } };
    if (!next.event_name?.trim()) throw new RuleError("The event name is required.");
    if (!HEX.test(next.theme_colour)) throw new RuleError("Theme colour must look like #1F4FE0.");
    if (!["instant", "approval"].includes(next.photo_approval)) throw new RuleError("Choose how photos are approved.");
    if (!Array.isArray(next.home_sections) || next.home_sections.some((s) => !SECTIONS.includes(s)) || new Set(next.home_sections).size !== next.home_sections.length) {
      throw new RuleError("Home sections must be Live, Standings, Schedule and Photos, each once.");
    }
    if (next.featured_match_id && !db.prepare("SELECT 1 FROM matches WHERE id = ?").get(next.featured_match_id)) throw new RuleError("The featured match no longer exists.");
    for (const k of Object.keys(patch) as (keyof Settings)[]) {
      db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(k, JSON.stringify(next[k]));
    }
    writeAudit(db, { userId: me.id, action: "settings", before: Object.fromEntries(Object.keys(patch).map((k) => [k, cur[k as keyof Settings]])), after: patch });
    bumpLive(db);
    return next;
  });
}
