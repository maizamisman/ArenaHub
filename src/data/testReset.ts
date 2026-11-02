import type { DatabaseSync } from "node:sqlite";
import { seed, DEFAULT_LOGINS } from "./seed.ts";

// Child tables first so foreign keys never block the wipe.
const TABLES = [
  "photo_likes", "photos", "audit_log", "request_ids", "rate_events", "sessions", "assignments", "match_events",
  "bracket_slots", "medal_results", "medal_rules", "matches", "courts", "teams", "sports", "announcements", "settings", "users",
];

/** Wipes and re-seeds the open database in place. Only reachable when ARENAHUB_E2E=1. */
export function resetForTests(db: DatabaseSync, totpSecret: string): void {
  db.exec("PRAGMA foreign_keys=OFF");
  for (const t of TABLES) db.exec(`DELETE FROM ${t}`);
  db.exec("PRAGMA foreign_keys=ON");
  seed(db, { adminPassword: DEFAULT_LOGINS.adminPassword, picPassword: DEFAULT_LOGINS.picPassword, adminTotpSecret: totpSecret });
}
