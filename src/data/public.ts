import { getDb, plain } from "./db.ts";
import type { BracketSlot, MedalResult, MedalRule, Team } from "../domain/types.ts";
import type { Lang } from "../i18n";

export type Court = { id: string; name: string; name_bm: string; lat: number; lng: number; notes: string };
export type Sport = { id: string; name: string; name_bm: string; format: string; active: number; sort: number; scoring: string };
export type Announcement = { id: string; title: string; body: string; lang: "en" | "bm"; updated_at: string };

export function listCourts(): Court[] {
  return plain<Court>(getDb().prepare("SELECT * FROM courts ORDER BY rowid").all());
}

export function listSports(): Sport[] {
  return plain<Sport>(getDb().prepare("SELECT * FROM sports WHERE active = 1 ORDER BY sort, name").all());
}

export function listTeams(): Team[] {
  return plain<Team>(getDb().prepare("SELECT * FROM teams ORDER BY short_name").all());
}

/** Published announcements in the chosen language, falling back to all when none match. */
export function listAnnouncements(lang: Lang): Announcement[] {
  const all = plain<Announcement>(getDb().prepare("SELECT id, title, body, lang, updated_at FROM announcements WHERE published = 1 ORDER BY updated_at DESC").all());
  const mine = all.filter((a) => a.lang === lang);
  return mine.length ? mine : all;
}

export function standingsInputs(): { teams: Team[]; rules: MedalRule[]; medalResults: MedalResult[]; sports: { id: string; name: string; name_bm: string }[] } {
  const db = getDb();
  return {
    teams: plain<Team>(db.prepare("SELECT * FROM teams WHERE active = 1").all()),
    rules: plain<MedalRule>(db.prepare("SELECT * FROM medal_rules").all()),
    medalResults: plain<MedalResult>(db.prepare("SELECT * FROM medal_results").all()),
    sports: plain<{ id: string; name: string; name_bm: string }>(db.prepare("SELECT id, name, name_bm FROM sports").all()),
  };
}

export function listBracketSlots(): BracketSlot[] {
  return plain<BracketSlot>(getDb().prepare("SELECT * FROM bracket_slots ORDER BY sport_id, round_index, slot_index").all());
}

export function photoCount(): number {
  return (getDb().prepare("SELECT COUNT(*) AS n FROM photos WHERE status = 'live'").get() as { n: number }).n;
}
