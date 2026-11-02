import type { DatabaseSync } from "node:sqlite";
import { getDb, tx, uuid, nowIso, plain } from "./db.ts";
import { writeAudit, bumpLive, liveVersion } from "./audit.ts";
import { canControlMatch } from "../domain/access.ts";
import { advanceWinner } from "../domain/bracket.ts";
import type { Assignment, BracketSlot, Match, MatchStatus, SessionUser, Side } from "../domain/types.ts";

export class ForbiddenError extends Error {
  constructor(message = "You are not assigned to this match.") { super(message); this.name = "ForbiddenError"; }
}
export class RuleError extends Error {
  constructor(message: string) { super(message); this.name = "RuleError"; }
}

export const EVENT_KINDS = ["goal", "point", "card_yellow", "card_red", "set", "substitution", "note"] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

const TRANSITIONS: Record<MatchStatus, MatchStatus[]> = {
  upcoming: ["live"],
  live: ["paused", "half_time", "full_time"],
  paused: ["live", "full_time"],
  half_time: ["live"],
  full_time: [],
};

export function getMatch(db: DatabaseSync, id: string): Match {
  const m = db.prepare("SELECT * FROM matches WHERE id = ?").get(id) as Match | undefined;
  if (!m) throw new RuleError("That match does not exist.");
  return m;
}

/** Re-reads the account so a deactivated user is refused on their very next action. */
export function actor(db: DatabaseSync, user: SessionUser): SessionUser {
  const row = db.prepare("SELECT id, name, email, role, active FROM users WHERE id = ?").get(user.id) as
    | { id: string; name: string; email: string; role: "admin" | "pic"; active: number } | undefined;
  if (!row || !row.active) throw new ForbiddenError("Your account is not active.");
  return { ...row, active: true };
}

/** The acting user, who must be the active Admin. */
export function requireAdmin(db: DatabaseSync, user: SessionUser): SessionUser {
  const me = actor(db, user);
  if (me.role !== "admin") throw new ForbiddenError("Only the Admin can do this.");
  return me;
}

function assignmentsFor(db: DatabaseSync, userId: string): Assignment[] {
  return db.prepare("SELECT user_id, match_id, court_id FROM assignments WHERE user_id = ?").all(userId) as Assignment[];
}

/** Loads the match and checks that this user may control it. */
function controlled(db: DatabaseSync, user: SessionUser, matchId: string): { me: SessionUser; m: Match } {
  const me = actor(db, user);
  const m = getMatch(db, matchId);
  if (!canControlMatch(me, m, assignmentsFor(db, me.id))) throw new ForbiddenError();
  return { me, m };
}

export function canUserControl(user: SessionUser, matchId: string): boolean {
  const db = getDb();
  try { controlled(db, user, matchId); return true; } catch { return false; }
}

const touch = (db: DatabaseSync, id: string) =>
  db.prepare("UPDATE matches SET version = version + 1, updated_at = ? WHERE id = ?").run(nowIso(), id);

const scores = (m: Match) => ({ score_a: m.score_a, score_b: m.score_b });

function isKnockout(db: DatabaseSync, m: Match): boolean {
  if (m.group_name) return false;
  const s = db.prepare("SELECT format FROM sports WHERE id = ?").get(m.sport_id) as { format: string } | undefined;
  return s?.format !== "medal_only";
}

/** Applies +1 or -1 with incremental SQL, so simultaneous taps never overwrite each other. */
export function applyScoreDelta(user: SessionUser, matchId: string, side: Side, delta: 1 | -1, requestId: string): Match {
  const db = getDb();
  return tx(db, () => {
    if (db.prepare("SELECT 1 FROM request_ids WHERE id = ?").get(requestId)) return getMatch(db, matchId);
    const { me, m } = controlled(db, user, matchId);
    if (m.status !== "live") throw new RuleError("Scores change only while the match is live.");
    if (delta !== 1 && delta !== -1) throw new RuleError("A score changes by one at a time.");
    const col = side === "a" ? "score_a" : "score_b";
    const r = db.prepare(`UPDATE matches SET ${col} = ${col} + ? WHERE id = ? AND ${col} + ? >= 0`).run(delta, matchId, delta);
    if (r.changes === 0) throw new RuleError("The score is already 0.");
    db.prepare("INSERT INTO request_ids (id, at) VALUES (?, ?)").run(requestId, nowIso());
    touch(db, matchId);
    const after = getMatch(db, matchId);
    writeAudit(db, { userId: me.id, action: "score_delta", matchId, before: scores(m), after: { ...scores(after), side, delta } });
    bumpLive(db);
    return after;
  });
}

export function setStatus(
  user: SessionUser, matchId: string, to: "live" | "paused" | "half_time" | "full_time", opts: { winner?: string; reason?: string } = {},
): Match {
  const db = getDb();
  return tx(db, () => {
    const { me, m } = controlled(db, user, matchId);
    if (!TRANSITIONS[m.status].includes(to)) throw new RuleError(`A match cannot go from ${label(m.status)} to ${label(to)}.`);
    if (!m.team_a || !m.team_b) throw new RuleError("Both teams must be decided before the match can start.");
    const now = nowIso();
    let elapsed = m.clock_elapsed_ms;
    if (m.status === "live" && m.clock_started_at) elapsed += Math.max(0, Date.parse(now) - Date.parse(m.clock_started_at));
    const startedAt = to === "live" ? now : null;

    let winner: string | null = null;
    let reason: string | null = null;
    if (to === "full_time") {
      if (m.score_a !== m.score_b) winner = m.score_a > m.score_b ? m.team_a : m.team_b;
      else if (isKnockout(db, m)) {
        if (!opts.winner) throw new RuleError("This knockout match is a draw. Choose the winner, for example after penalties.");
        if (opts.winner !== m.team_a && opts.winner !== m.team_b) throw new RuleError("The winner must be one of the two teams.");
        if (!opts.reason?.trim()) throw new RuleError("Give a reason for choosing the winner of a draw.");
        winner = opts.winner;
        reason = opts.reason.trim();
      }
    }

    db.prepare("UPDATE matches SET status = ?, clock_started_at = ?, clock_elapsed_ms = ?, winner = ? WHERE id = ?")
      .run(to, startedAt, elapsed, winner, matchId);
    touch(db, matchId);
    const after = getMatch(db, matchId);
    writeAudit(db, { userId: me.id, action: "status", matchId, before: { status: m.status, ...scores(m) }, after: { status: to, ...scores(after), winner }, reason });

    if (to === "full_time" && winner) {
      const slots = db.prepare("SELECT * FROM bracket_slots WHERE sport_id = ?").all(m.sport_id) as BracketSlot[];
      const next = advanceWinner(slots, [after], matchId);
      if (next) {
        const target = getMatch(db, next.matchId);
        const col = next.side === "a" ? "team_a" : "team_b";
        if (target[col] !== next.team) {
          // A round already under way is never rewritten; the Admin must reopen it first.
          if (target.status !== "upcoming") throw new RuleError("The winner has changed, but the next round has already started. Reopen the next round and change its teams first, then end this match again.");
          db.prepare(`UPDATE matches SET ${col} = ? WHERE id = ?`).run(next.team, next.matchId);
          touch(db, next.matchId);
          writeAudit(db, { userId: me.id, action: "advance", matchId: next.matchId, before: { [col]: target[col] }, after: { [col]: next.team } });
        }
      }
    }
    bumpLive(db);
    return after;
  });
}

export function correctScore(user: SessionUser, matchId: string, scoreA: number, scoreB: number, reason: string): Match {
  const db = getDb();
  return tx(db, () => {
    const { me, m } = controlled(db, user, matchId);
    if (!reason?.trim()) throw new RuleError("A correction needs a reason.");
    if (![scoreA, scoreB].every((n) => Number.isInteger(n) && n >= 0)) throw new RuleError("Scores must be whole numbers, 0 or more.");
    if (m.status === "full_time") throw new RuleError("This match is finished. Ask the Admin to reopen it first.");
    if (m.status === "upcoming") throw new RuleError("Start the match before changing its score.");
    db.prepare("UPDATE matches SET score_a = ?, score_b = ? WHERE id = ?").run(scoreA, scoreB, matchId);
    touch(db, matchId);
    const after = getMatch(db, matchId);
    writeAudit(db, { userId: me.id, action: "score_correct", matchId, before: scores(m), after: scores(after), reason: reason.trim() });
    bumpLive(db);
    return after;
  });
}

/** Reverts this user's most recent score change on the match that has not been undone yet. */
export function undoLast(user: SessionUser, matchId: string): Match {
  const db = getDb();
  return tx(db, () => {
    const { me, m } = controlled(db, user, matchId);
    const last = db.prepare(
      `SELECT id, action, before, after FROM audit_log
       WHERE match_id = ? AND user_id = ? AND action IN ('score_delta','score_correct')
         AND id NOT IN (SELECT json_extract(before, '$.undo_of') FROM audit_log WHERE match_id = ? AND action = 'score_undo')
       ORDER BY rowid DESC LIMIT 1`,
    ).get(matchId, me.id, matchId) as { id: string; action: string; before: string; after: string } | undefined;
    if (!last) throw new RuleError("There is nothing of yours to undo on this match.");
    // Undo only reverses your latest change while nobody has corrected, undone or reopened since.
    const later = db.prepare(
      `SELECT 1 FROM audit_log WHERE match_id = ? AND rowid > (SELECT rowid FROM audit_log WHERE id = ?)
       AND (action IN ('score_correct', 'score_undo', 'reopen') OR (action = 'score_delta' AND ? = 'score_correct'))`,
    ).get(matchId, last.id, last.action);
    if (later) throw new RuleError("The score was changed after your last update. Use Correct score instead.");
    if (m.status === "full_time") throw new RuleError("This match is finished. Ask the Admin to reopen it first.");

    if (last.action === "score_delta") {
      if (m.status !== "live") throw new RuleError("Scores change only while the match is live.");
      const { side, delta } = JSON.parse(last.after) as { side: Side; delta: number };
      const col = side === "a" ? "score_a" : "score_b";
      const r = db.prepare(`UPDATE matches SET ${col} = ${col} - ? WHERE id = ? AND ${col} - ? >= 0`).run(delta, matchId, delta);
      if (r.changes === 0) throw new RuleError("The score is already 0.");
    } else {
      const prev = JSON.parse(last.before) as { score_a: number; score_b: number };
      db.prepare("UPDATE matches SET score_a = ?, score_b = ? WHERE id = ?").run(prev.score_a, prev.score_b, matchId);
    }
    touch(db, matchId);
    const after = getMatch(db, matchId);
    writeAudit(db, { userId: me.id, action: "score_undo", matchId, before: { undo_of: last.id, ...scores(m) }, after: scores(after) });
    bumpLive(db);
    return after;
  });
}

export function addEvent(
  user: SessionUser, matchId: string, e: { kind: EventKind; team?: string | null; detail: string; minuteLabel: string },
): { id: string } {
  const db = getDb();
  return tx(db, () => {
    const { me, m } = controlled(db, user, matchId);
    if (!EVENT_KINDS.includes(e.kind)) throw new RuleError("Unknown event type.");
    const team = e.team || null;
    if (team && team !== m.team_a && team !== m.team_b) throw new RuleError("That team is not playing in this match.");
    const detail = (e.detail ?? "").trim().slice(0, 200);
    const minute = (e.minuteLabel ?? "").trim().slice(0, 20);
    const id = uuid();
    db.prepare("INSERT INTO match_events VALUES (?,?,?,?,?,?,?,?)").run(id, matchId, e.kind, team, detail, minute, me.id, nowIso());
    touch(db, matchId);
    writeAudit(db, { userId: me.id, action: "event", matchId, after: { kind: e.kind, team, detail, minute } });
    bumpLive(db);
    return { id };
  });
}

export function reopenMatch(admin: SessionUser, matchId: string, reason: string): Match {
  const db = getDb();
  return tx(db, () => {
    const me = actor(db, admin);
    if (me.role !== "admin") throw new ForbiddenError("Only the Admin can reopen a finished match.");
    if (!reason?.trim()) throw new RuleError("Reopening needs a reason.");
    const m = getMatch(db, matchId);
    if (m.status !== "full_time") throw new RuleError("Only a finished match can be reopened.");
    db.prepare("UPDATE matches SET status = 'paused', winner = NULL, clock_started_at = NULL WHERE id = ?").run(matchId);
    touch(db, matchId);
    const after = getMatch(db, matchId);
    writeAudit(db, { userId: me.id, action: "reopen", matchId, before: { status: m.status, winner: m.winner, ...scores(m) }, after: { status: after.status, ...scores(after) }, reason: reason.trim() });
    bumpLive(db);
    return after;
  });
}

export function label(s: MatchStatus): string {
  return { upcoming: "Upcoming", live: "Live", paused: "Paused", half_time: "Half Time", full_time: "Full Time" }[s];
}

// ---------- public snapshot ----------

export type TeamRef = { id: string; short_name: string; institution: string } | null;
export type PublicMatch = {
  id: string;
  sport: { id: string; name: string; name_bm: string; format: string };
  round: string;
  group_name: string | null;
  team_a: TeamRef;
  team_b: TeamRef;
  court: { id: string; name: string; name_bm: string; lat: number; lng: number };
  starts_at: string;
  status: MatchStatus;
  score_a: number;
  score_b: number;
  winner: string | null;
  clock_started_at: string | null;
  clock_elapsed_ms: number;
  version: number;
};
export type PublicEvent = { id: string; match_id: string; kind: EventKind; team: string | null; detail: string; minute_label: string; created_at: string };
export type LiveSnapshot = { serverNow: string; version: number; matches: PublicMatch[]; events: PublicEvent[] };

type Row = Match & {
  s_name: string; s_bm: string; s_format: string; ta_short: string | null; ta_inst: string | null; tb_short: string | null; tb_inst: string | null;
  c_name: string; c_bm: string; c_lat: number; c_lng: number;
};

const MATCH_SQL = `
  SELECT m.*, s.name s_name, s.name_bm s_bm, s.format s_format,
         ta.short_name ta_short, ta.institution ta_inst, tb.short_name tb_short, tb.institution tb_inst,
         c.name c_name, c.name_bm c_bm, c.lat c_lat, c.lng c_lng
  FROM matches m JOIN sports s ON s.id = m.sport_id JOIN courts c ON c.id = m.court_id
  LEFT JOIN teams ta ON ta.id = m.team_a LEFT JOIN teams tb ON tb.id = m.team_b`;

function toPublic(r: Row): PublicMatch {
  return {
    id: r.id,
    sport: { id: r.sport_id, name: r.s_name, name_bm: r.s_bm, format: r.s_format },
    round: r.round, group_name: r.group_name,
    team_a: r.team_a ? { id: r.team_a, short_name: r.ta_short!, institution: r.ta_inst! } : null,
    team_b: r.team_b ? { id: r.team_b, short_name: r.tb_short!, institution: r.tb_inst! } : null,
    court: { id: r.court_id, name: r.c_name, name_bm: r.c_bm, lat: r.c_lat, lng: r.c_lng },
    starts_at: r.starts_at, status: r.status, score_a: r.score_a, score_b: r.score_b, winner: r.winner,
    clock_started_at: r.clock_started_at, clock_elapsed_ms: r.clock_elapsed_ms, version: r.version,
  };
}

export function listPublicMatches(db: DatabaseSync = getDb()): PublicMatch[] {
  return (db.prepare(`${MATCH_SQL} WHERE s.active = 1 ORDER BY m.starts_at, s.sort`).all() as Row[]).map(toPublic);
}

export function getPublicMatch(id: string, db: DatabaseSync = getDb()): PublicMatch | null {
  const r = db.prepare(`${MATCH_SQL} WHERE m.id = ?`).get(id) as Row | undefined;
  return r ? toPublic(r) : null;
}

export function getLiveSnapshot(): LiveSnapshot {
  const db = getDb();
  const events = plain<PublicEvent>(db.prepare(
    "SELECT id, match_id, kind, team, detail, minute_label, created_at FROM match_events ORDER BY created_at DESC, rowid DESC",
  ).all());
  return { serverNow: nowIso(), version: liveVersion(db), matches: listPublicMatches(db), events };
}

// ---------- portal reads ----------

/** Matches this user may control: all for the Admin, assigned ones (by match or court) for a PIC. */
export function listMatchesFor(user: SessionUser): PublicMatch[] {
  const db = getDb();
  const all = listPublicMatches(db);
  if (user.role === "admin") return all;
  const asg = assignmentsFor(db, user.id);
  return all.filter((m) => canControlMatch(user, { id: m.id, court_id: m.court.id }, asg));
}

export type LogLine = { id: string; at: string; who: string; text: string; reason: string | null };

/** The score record for one match, newest first, in plain words. */
export function matchLog(matchId: string): LogLine[] {
  const db = getDb();
  const m = getPublicMatch(matchId, db);
  const name = (side: "a" | "b") => (side === "a" ? m?.team_a?.short_name : m?.team_b?.short_name) ?? "?";
  const rows = db.prepare(
    `SELECT a.id, a.at, a.action, a.before, a.after, a.reason, COALESCE(u.name, 'System') AS who
     FROM audit_log a LEFT JOIN users u ON u.id = a.user_id WHERE a.match_id = ? ORDER BY a.rowid DESC LIMIT 200`,
  ).all(matchId) as { id: string; at: string; action: string; before: string | null; after: string | null; reason: string | null; who: string }[];
  return rows.map((r) => {
    const b = r.before ? JSON.parse(r.before) : {};
    const a = r.after ? JSON.parse(r.after) : {};
    const sc = (x: { score_a?: number; score_b?: number }) => `${x.score_a}-${x.score_b}`;
    let text = r.action;
    if (r.action === "score_delta") text = `${a.delta > 0 ? "+1" : "−1"} for ${name(a.side)}, ${sc(a)}`;
    else if (r.action === "score_correct") text = `Score corrected from ${sc(b)} to ${sc(a)}`;
    else if (r.action === "score_undo") text = `Undo, back to ${sc(a)}`;
    else if (r.action === "status") text = `${label(b.status)} to ${label(a.status)}${a.status === "full_time" ? `, ${sc(a)}` : ""}`;
    else if (r.action === "reopen") text = `Reopened (was ${sc(b)})`;
    else if (r.action === "advance") text = "Winner moved into this match";
    else if (r.action === "event") text = `Event: ${a.kind}${a.detail ? `, ${a.detail}` : ""}`;
    return { id: r.id, at: r.at, who: r.who, text, reason: r.reason };
  });
}
