import type { DatabaseSync } from "node:sqlite";
import { getDb, tx, uuid, nowIso, plain } from "./db.ts";
import { writeAudit, bumpLive } from "./audit.ts";
import { requireAdmin, getMatch, RuleError } from "./matches.ts";
import type { BracketSlot, Match, MedalResult, MedalRule, SessionUser } from "../domain/types.ts";

const COURT_GAP_MS = 30 * 60_000;
const FORMATS = ["knockout", "group_knockout", "medal_only"] as const;
const clean = (s: unknown, max = 120) => String(s ?? "").trim().slice(0, max);
const required = (v: string, what: string) => { if (!v) throw new RuleError(`${what} is required.`); return v; };

/** Runs an Admin change in one transaction with an audit row. */
function adminTx<T>(user: SessionUser, fn: (db: DatabaseSync, me: SessionUser) => T): T {
  const db = getDb();
  return tx(db, () => {
    const me = requireAdmin(db, user);
    const out = fn(db, me);
    bumpLive(db);
    return out;
  });
}

const row = <T>(db: DatabaseSync, table: string, id: string) => db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id) as T | undefined;
const used = (db: DatabaseSync, sql: string, ...a: string[]) => !!db.prepare(sql).get(...a);

// ---------- sports ----------

export type SportInput = { id?: string; name: string; name_bm: string; format: string; scoring: string; active: boolean; sort?: number };

export function saveSport(user: SessionUser, s: SportInput) {
  return adminTx(user, (db, me) => {
    const name = required(clean(s.name), "Name");
    const v = { name, name_bm: clean(s.name_bm) || name, format: s.format, scoring: clean(s.scoring, 40) || "Points", active: s.active ? 1 : 0, sort: Number(s.sort ?? 0) || 0 };
    if (!FORMATS.includes(v.format as (typeof FORMATS)[number])) throw new RuleError("Choose a format.");
    const before = s.id ? row(db, "sports", s.id) : undefined;
    const id = s.id && before ? s.id : uuid();
    if (before) db.prepare("UPDATE sports SET name=?, name_bm=?, format=?, scoring=?, active=?, sort=? WHERE id=?").run(v.name, v.name_bm, v.format, v.scoring, v.active, v.sort, id);
    else {
      db.prepare("INSERT INTO sports VALUES (?,?,?,?,?,?,?)").run(id, v.name, v.name_bm, v.format, v.scoring, v.active, v.sort);
      // Default medal rules for a new knockout sport: final winner gold, loser silver, third place bronze.
      if (v.format !== "medal_only") for (const [r, m, o] of [["Final", "gold", "winner"], ["Final", "silver", "loser"], ["Third place", "bronze", "winner"]]) db.prepare("INSERT INTO medal_rules VALUES (?,?,?,?)").run(id, r, m, o);
    }
    writeAudit(db, { userId: me.id, action: before ? "sport_update" : "sport_create", before, after: { id, ...v } });
    return { id };
  });
}

export function deleteSport(user: SessionUser, id: string) {
  return adminTx(user, (db, me) => {
    if (used(db, "SELECT 1 FROM matches WHERE sport_id = ?", id) || used(db, "SELECT 1 FROM medal_results WHERE sport_id = ?", id)) {
      throw new RuleError("This sport still has matches or medal results. Remove those first, or switch the sport off instead.");
    }
    const before = row(db, "sports", id);
    db.prepare("DELETE FROM sports WHERE id = ?").run(id);
    writeAudit(db, { userId: me.id, action: "sport_delete", before });
  });
}

/** Which rounds award which medals for a sport. Replaces the sport's rules. */
export function saveMedalRules(user: SessionUser, sportId: string, rules: Omit<MedalRule, "sport_id">[]) {
  return adminTx(user, (db, me) => {
    if (!row(db, "sports", sportId)) throw new RuleError("That sport does not exist.");
    const seen = new Set<string>();
    for (const r of rules) {
      if (!["gold", "silver", "bronze"].includes(r.medal) || !["winner", "loser"].includes(r.outcome) || !clean(r.round)) throw new RuleError("Each rule needs a round, a medal and winner or loser.");
      const k = `${r.round}|${r.medal}`;
      if (seen.has(k)) throw new RuleError(`The ${r.medal} medal is listed twice for ${r.round}.`);
      seen.add(k);
    }
    const before = db.prepare("SELECT round, medal, outcome FROM medal_rules WHERE sport_id = ?").all(sportId);
    db.prepare("DELETE FROM medal_rules WHERE sport_id = ?").run(sportId);
    for (const r of rules) db.prepare("INSERT INTO medal_rules VALUES (?,?,?,?)").run(sportId, clean(r.round), r.medal, r.outcome);
    writeAudit(db, { userId: me.id, action: "medal_rules", before, after: rules });
  });
}

export function listMedalRules(): MedalRule[] {
  return plain<MedalRule>(getDb().prepare("SELECT * FROM medal_rules ORDER BY sport_id, round, medal").all());
}

// ---------- teams ----------

export type TeamInput = { id?: string; short_name: string; institution: string; manager: string; active: boolean };

export function saveTeam(user: SessionUser, t: TeamInput) {
  return adminTx(user, (db, me) => {
    const v = { short_name: required(clean(t.short_name, 40), "Short name"), institution: required(clean(t.institution), "Institution"), manager: clean(t.manager), active: t.active ? 1 : 0 };
    const clash = db.prepare("SELECT id FROM teams WHERE short_name = ? COLLATE NOCASE AND id != ?").get(v.short_name, t.id ?? "") as { id: string } | undefined;
    if (clash) throw new RuleError("Another team already uses that short name.");
    const before = t.id ? row(db, "teams", t.id) : undefined;
    const id = t.id && before ? t.id : uuid();
    if (before) db.prepare("UPDATE teams SET short_name=?, institution=?, manager=?, active=? WHERE id=?").run(v.short_name, v.institution, v.manager, v.active, id);
    else db.prepare("INSERT INTO teams VALUES (?,?,?,?,?)").run(id, v.short_name, v.institution, v.manager, v.active);
    writeAudit(db, { userId: me.id, action: before ? "team_update" : "team_create", before, after: { id, ...v } });
    return { id };
  });
}

export function deleteTeam(user: SessionUser, id: string) {
  return adminTx(user, (db, me) => {
    if (used(db, "SELECT 1 FROM matches WHERE ? IN (team_a, team_b, winner)", id)) throw new RuleError("This team still has matches. Remove it from those matches first, or switch the team off instead.");
    if (used(db, "SELECT 1 FROM medal_results WHERE ? IN (gold, silver, bronze)", id)) throw new RuleError("This team has medal results. Change those first.");
    const before = row(db, "teams", id);
    db.prepare("DELETE FROM teams WHERE id = ?").run(id);
    writeAudit(db, { userId: me.id, action: "team_delete", before });
  });
}

// ---------- courts ----------

export type CourtInput = { id?: string; name: string; name_bm: string; lat: number; lng: number; notes: string };

export function saveCourt(user: SessionUser, c: CourtInput) {
  return adminTx(user, (db, me) => {
    const lat = Number(c.lat), lng = Number(c.lng);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) throw new RuleError("Enter a latitude between -90 and 90 and a longitude between -180 and 180.");
    const name = required(clean(c.name), "Name");
    const v = { name, name_bm: clean(c.name_bm) || name, lat, lng, notes: clean(c.notes, 300) };
    const before = c.id ? row(db, "courts", c.id) : undefined;
    const id = c.id && before ? c.id : uuid();
    if (before) db.prepare("UPDATE courts SET name=?, name_bm=?, lat=?, lng=?, notes=? WHERE id=?").run(v.name, v.name_bm, v.lat, v.lng, v.notes, id);
    else db.prepare("INSERT INTO courts VALUES (?,?,?,?,?,?)").run(id, v.name, v.name_bm, v.lat, v.lng, v.notes);
    writeAudit(db, { userId: me.id, action: before ? "court_update" : "court_create", before, after: { id, ...v } });
    return { id };
  });
}

export function deleteCourt(user: SessionUser, id: string) {
  return adminTx(user, (db, me) => {
    if (used(db, "SELECT 1 FROM matches WHERE court_id = ?", id)) throw new RuleError("Matches are still scheduled at this court. Move them first.");
    const before = row(db, "courts", id);
    db.prepare("DELETE FROM courts WHERE id = ?").run(id);
    writeAudit(db, { userId: me.id, action: "court_delete", before });
  });
}

// ---------- matches ----------

export type MatchInput = { id?: string; sport_id: string; round: string; group_name?: string | null; team_a: string | null; team_b: string | null; court_id: string; starts_at: string };

export function saveMatch(user: SessionUser, m: MatchInput): Match {
  return adminTx(user, (db, me) => {
    const round = required(clean(m.round, 60), "Round");
    if (!row(db, "sports", m.sport_id)) throw new RuleError("Choose a sport.");
    if (!row(db, "courts", m.court_id)) throw new RuleError("Choose a court.");
    const a = m.team_a || null, b = m.team_b || null;
    for (const t of [a, b]) if (t && !row(db, "teams", t)) throw new RuleError("Choose teams from the list.");
    if (a && a === b) throw new RuleError("A team cannot play itself.");
    const start = Date.parse(m.starts_at);
    if (!Number.isFinite(start)) throw new RuleError("Enter a valid date and time.");
    const clash = db.prepare(
      `SELECT id, starts_at FROM matches WHERE court_id = ? AND id != ? AND status != 'full_time'
       AND ABS(strftime('%s', starts_at) - strftime('%s', ?)) * 1000 < ?`,
    ).get(m.court_id, m.id ?? "", new Date(start).toISOString(), COURT_GAP_MS) as { id: string } | undefined;
    if (clash) throw new RuleError("Another match is on this court within 30 minutes of that time. Choose another court or time.");

    const before = m.id ? (row<Match>(db, "matches", m.id)) : undefined;
    const id = m.id && before ? m.id : uuid();
    const group = clean(m.group_name, 20) || null;
    if (before) {
      if (before.status !== "upcoming" && (before.team_a !== a || before.team_b !== b)) throw new RuleError("Teams can only be changed before the match starts.");
      db.prepare("UPDATE matches SET sport_id=?, round=?, group_name=?, team_a=?, team_b=?, court_id=?, starts_at=?, version=version+1, updated_at=? WHERE id=?")
        .run(m.sport_id, round, group, a, b, m.court_id, new Date(start).toISOString(), nowIso(), id);
    } else {
      db.prepare("INSERT INTO matches (id, sport_id, round, group_name, team_a, team_b, court_id, starts_at, status, updated_at) VALUES (?,?,?,?,?,?,?,?, 'upcoming', ?)")
        .run(id, m.sport_id, round, group, a, b, m.court_id, new Date(start).toISOString(), nowIso());
    }
    const after = getMatch(db, id);
    writeAudit(db, { userId: me.id, action: before ? "match_update" : "match_create", matchId: id, before, after });
    return after;
  });
}

export function deleteMatch(user: SessionUser, id: string) {
  return adminTx(user, (db, me) => {
    const before = getMatch(db, id);
    if (before.status !== "upcoming") throw new RuleError("Only a match that has not started can be deleted. Reopen or correct it instead.");
    db.prepare("UPDATE bracket_slots SET match_id = NULL WHERE match_id = ?").run(id);
    db.prepare("DELETE FROM matches WHERE id = ?").run(id);
    writeAudit(db, { userId: me.id, action: "match_delete", matchId: id, before });
  });
}

// ---------- medal-only results ----------

export type MedalResultInput = { id?: string; sport_id: string; event_name: string; gold: string | null; silver: string | null; bronze: string | null };

export function saveMedalResult(user: SessionUser, r: MedalResultInput) {
  return adminTx(user, (db, me) => {
    const event = required(clean(r.event_name, 80), "Event name");
    if (!row(db, "sports", r.sport_id)) throw new RuleError("Choose a sport.");
    const picks = [r.gold, r.silver, r.bronze].map((x) => x || null);
    const chosen = picks.filter(Boolean);
    if (new Set(chosen).size !== chosen.length) throw new RuleError("A team can win only one medal in an event.");
    if (!picks[0]) throw new RuleError("Choose the gold medal team.");
    const before = r.id ? row<MedalResult>(db, "medal_results", r.id) : undefined;
    const id = r.id && before ? r.id : uuid();
    if (before) db.prepare("UPDATE medal_results SET sport_id=?, event_name=?, gold=?, silver=?, bronze=? WHERE id=?").run(r.sport_id, event, picks[0], picks[1], picks[2], id);
    else db.prepare("INSERT INTO medal_results VALUES (?,?,?,?,?,?)").run(id, r.sport_id, event, picks[0], picks[1], picks[2]);
    writeAudit(db, { userId: me.id, action: before ? "medal_result_update" : "medal_result_create", before, after: { id, sport_id: r.sport_id, event, gold: picks[0], silver: picks[1], bronze: picks[2] }, reason: "Medal standings changed" });
    return { id };
  });
}

export function deleteMedalResult(user: SessionUser, id: string) {
  return adminTx(user, (db, me) => {
    const before = row(db, "medal_results", id);
    db.prepare("DELETE FROM medal_results WHERE id = ?").run(id);
    writeAudit(db, { userId: me.id, action: "medal_result_delete", before });
  });
}

export function listMedalResults(): MedalResult[] {
  return plain<MedalResult>(getDb().prepare("SELECT * FROM medal_results ORDER BY rowid").all());
}

// ---------- brackets ----------

/** Creates an empty knockout bracket for a sport: first round of n matches (2, 4 or 8), halving to a final. */
export function createBracket(user: SessionUser, sportId: string, firstRound: number) {
  return adminTx(user, (db, me) => {
    if (![1, 2, 4, 8].includes(firstRound)) throw new RuleError("A bracket starts with 1, 2, 4 or 8 matches.");
    if (used(db, "SELECT 1 FROM bracket_slots WHERE sport_id = ?", sportId)) throw new RuleError("This sport already has a bracket. Clear it first.");
    const rounds: string[][] = [];
    for (let n = firstRound; n >= 1; n = n / 2) rounds.push(Array.from({ length: n }, () => uuid()));
    rounds.forEach((r, ri) => r.forEach((id, si) => db.prepare("INSERT INTO bracket_slots VALUES (?,?,?,?,NULL,NULL,NULL)").run(id, sportId, ri, si)));
    rounds.forEach((r, ri) => r.forEach((id, si) => {
      const next = rounds[ri + 1]?.[Math.floor(si / 2)];
      if (next) db.prepare("UPDATE bracket_slots SET feeds_slot_id = ?, feeds_side = ? WHERE id = ?").run(next, si % 2 ? "b" : "a", id);
    }));
    writeAudit(db, { userId: me.id, action: "bracket_create", after: { sportId, firstRound } });
  });
}

export function clearBracket(user: SessionUser, sportId: string) {
  return adminTx(user, (db, me) => {
    db.prepare("UPDATE bracket_slots SET feeds_slot_id = NULL WHERE sport_id = ?").run(sportId);
    db.prepare("DELETE FROM bracket_slots WHERE sport_id = ?").run(sportId);
    writeAudit(db, { userId: me.id, action: "bracket_clear", after: { sportId } });
  });
}

/** Puts a match (of the same sport) into a bracket slot, or empties it. */
export function setSlotMatch(user: SessionUser, slotId: string, matchId: string | null) {
  return adminTx(user, (db, me) => {
    const slot = row<BracketSlot>(db, "bracket_slots", slotId);
    if (!slot) throw new RuleError("That bracket slot no longer exists.");
    if (matchId) {
      const m = getMatch(db, matchId);
      if (m.sport_id !== slot.sport_id) throw new RuleError("Choose a match from the same sport.");
      db.prepare("UPDATE bracket_slots SET match_id = NULL WHERE match_id = ?").run(matchId);
    }
    db.prepare("UPDATE bracket_slots SET match_id = ? WHERE id = ?").run(matchId, slotId);
    writeAudit(db, { userId: me.id, action: "bracket_slot", matchId, before: { slot: slotId, match: slot.match_id }, after: { slot: slotId, match: matchId } });
  });
}
