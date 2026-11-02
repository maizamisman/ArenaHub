import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { openDb, setDb } from "@/data/db";
import {
  applyScoreDelta, setStatus, correctScore, undoLast, reopenMatch, addEvent, getLiveSnapshot, ForbiddenError, RuleError,
} from "@/data/matches";
import { freshDb, userByEmail, matchId } from "../helpers";

let db: DatabaseSync;
const rid = () => crypto.randomUUID();
const score = (id: string) => db.prepare("SELECT score_a, score_b, status, winner FROM matches WHERE id = ?").get(id) as { score_a: number; score_b: number; status: string; winner: string | null };
const teamId = (short: string) => (db.prepare("SELECT id FROM teams WHERE short_name = ?").get(short) as { id: string }).id;

beforeEach(() => { db = freshDb(); });

describe("score and match commands", () => {
  it("PIC cannot score an unassigned match", () => {
    const aina = userByEmail(db, "aina@arenahub.my");
    const danialsMatch = matchId(db, "UiTM Laut", "UTM Laut", "Semi-final 2"); // futsal, Danial's
    expect(() => applyScoreDelta(aina, danialsMatch, "a", 1, rid())).toThrow(ForbiddenError);
    expect(score(danialsMatch).score_a).toBe(4);
  });

  it("deactivated PIC is refused on the next action", () => {
    const aina = userByEmail(db, "aina@arenahub.my");
    const m = matchId(db, "UM Laut", "UMT Laut", "Final");
    db.prepare("UPDATE users SET active = 0 WHERE id = ?").run(aina.id);
    expect(() => applyScoreDelta(aina, m, "a", 1, rid())).toThrow(ForbiddenError);
  });

  it("score only changes while live", () => {
    const aina = userByEmail(db, "aina@arenahub.my");
    const upcoming = matchId(db, "UKM Laut", "USM Laut", "Third place");
    expect(() => applyScoreDelta(aina, upcoming, "a", 1, rid())).toThrow(RuleError);
    setStatus(aina, upcoming, "live");
    expect(applyScoreDelta(aina, upcoming, "a", 1, rid()).score_a).toBe(1);
    setStatus(aina, upcoming, "paused");
    expect(() => applyScoreDelta(aina, upcoming, "a", 1, rid())).toThrow(/only while the match is live/);
  });

  it("minus at zero is refused", () => {
    const aina = userByEmail(db, "aina@arenahub.my");
    const m = matchId(db, "UKM Laut", "USM Laut", "Third place");
    setStatus(aina, m, "live");
    expect(() => applyScoreDelta(aina, m, "b", -1, rid())).toThrow(RuleError);
    expect(score(m).score_b).toBe(0);
  });

  it("same requestId twice counts once", () => {
    const aina = userByEmail(db, "aina@arenahub.my");
    const m = matchId(db, "UM Laut", "UMT Laut", "Final");
    const id = rid();
    applyScoreDelta(aina, m, "a", 1, id);
    const again = applyScoreDelta(aina, m, "a", 1, id);
    expect(again.score_a).toBe(3);
    expect(score(m).score_a).toBe(3);
  });

  it("fifty interleaved deltas from two users all count", () => {
    // Two connections to one file, as two server processes would have.
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "ah-")), "t.db");
    const db1 = freshDb(file);
    const db2 = openDb(file);
    const admin = userByEmail(db1, "admin@arenahub.my");
    const aina = userByEmail(db1, "aina@arenahub.my");
    const m = matchId(db1, "UM Laut", "UMT Laut", "Final");
    for (let i = 0; i < 50; i++) {
      setDb(i % 2 ? db2 : db1);
      applyScoreDelta(i % 2 ? admin : aina, m, i % 3 ? "a" : "b", 1, rid());
    }
    const r = db1.prepare("SELECT score_a, score_b FROM matches WHERE id = ?").get(m) as { score_a: number; score_b: number };
    expect(r.score_a + r.score_b).toBe(2 + 1 + 50);
    db1.close(); db2.close();
  });

  it("every change writes audit with before and after", () => {
    const aina = userByEmail(db, "aina@arenahub.my");
    const m = matchId(db, "UM Laut", "UMT Laut", "Final");
    applyScoreDelta(aina, m, "b", 1, rid());
    correctScore(aina, m, 3, 2, "Referee correction");
    setStatus(aina, m, "paused");
    const rows = db.prepare("SELECT action, user_id, before, after, reason FROM audit_log WHERE match_id = ? ORDER BY rowid").all(m) as { action: string; user_id: string; before: string; after: string; reason: string | null }[];
    expect(rows.map((r) => r.action)).toEqual(["score_delta", "score_correct", "status"]);
    expect(rows.every((r) => r.user_id === aina.id)).toBe(true);
    expect(JSON.parse(rows[0].before)).toMatchObject({ score_a: 2, score_b: 1 });
    expect(JSON.parse(rows[0].after)).toMatchObject({ score_a: 2, score_b: 2 });
    expect(rows[1].reason).toBe("Referee correction");
    expect(JSON.parse(rows[2].after)).toMatchObject({ status: "paused" });
    expect(() => correctScore(aina, m, 1, 1, " ")).toThrow(/reason/i);
  });

  it("undo restores the previous score", () => {
    const aina = userByEmail(db, "aina@arenahub.my");
    const m = matchId(db, "UM Laut", "UMT Laut", "Final");
    applyScoreDelta(aina, m, "a", 1, rid());
    expect(undoLast(aina, m).score_a).toBe(2);
    expect(() => undoLast(aina, m)).toThrow(RuleError); // nothing left of hers to undo
    const actions = (db.prepare("SELECT action FROM audit_log WHERE match_id = ?").all(m) as { action: string }[]).map((r) => r.action);
    expect(actions).toContain("score_undo");
  });

  it("full time on a knockout draw requires a winner", () => {
    const danial = userByEmail(db, "danial@arenahub.my");
    const m = matchId(db, "UiTM Laut", "UTM Laut", "Semi-final 2"); // futsal 4-4
    expect(() => setStatus(danial, m, "full_time")).toThrow(/winner/i);
    expect(() => setStatus(danial, m, "full_time", { winner: teamId("UiTM Laut") })).toThrow(/reason/i);
    expect(() => setStatus(danial, m, "full_time", { winner: teamId("UM Laut"), reason: "Penalties" })).toThrow(RuleError);
    const done = setStatus(danial, m, "full_time", { winner: teamId("UTM Laut"), reason: "Won 5-4 on penalties" });
    expect(done.status).toBe("full_time");
    expect(done.winner).toBe(teamId("UTM Laut"));
  });

  it("full time advances winner to the final", () => {
    const danial = userByEmail(db, "danial@arenahub.my");
    const sf2 = matchId(db, "UiTM Laut", "UTM Laut", "Semi-final 2");
    applyScoreDelta(danial, sf2, "a", 1, rid());
    setStatus(danial, sf2, "full_time");
    const final = matchId(db, "UPM Laut", "UiTM Laut", "Final");
    expect(score(final).status).toBe("upcoming");
  });

  it("status transitions follow the rules", () => {
    const aina = userByEmail(db, "aina@arenahub.my");
    const m = matchId(db, "UKM Laut", "USM Laut", "Third place");
    expect(() => setStatus(aina, m, "paused")).toThrow(RuleError);
    setStatus(aina, m, "live");
    setStatus(aina, m, "half_time");
    expect(() => setStatus(aina, m, "full_time")).toThrow(RuleError);
    setStatus(aina, m, "live");
    expect(setStatus(aina, m, "paused").status).toBe("paused");
  });

  it("reopen is admin only and is audited", () => {
    const aina = userByEmail(db, "aina@arenahub.my");
    const admin = userByEmail(db, "admin@arenahub.my");
    const m = matchId(db, "UM Laut", "UKM Laut", "Semi-final 1"); // football, finished
    expect(() => reopenMatch(aina, m, "Wrong result")).toThrow(ForbiddenError);
    expect(() => applyScoreDelta(admin, m, "a", 1, rid())).toThrow(RuleError);
    const r = reopenMatch(admin, m, "Wrong result entered");
    expect(r.status).toBe("paused");
    expect(r.winner).toBeNull();
    const row = db.prepare("SELECT reason, user_id FROM audit_log WHERE match_id = ? AND action = 'reopen'").get(m) as { reason: string; user_id: string };
    expect(row).toEqual({ reason: "Wrong result entered", user_id: admin.id });
  });

  it("events are added and the live snapshot version moves", () => {
    const aina = userByEmail(db, "aina@arenahub.my");
    const m = matchId(db, "UM Laut", "UMT Laut", "Final");
    const v0 = getLiveSnapshot().version;
    addEvent(aina, m, { kind: "card_yellow", team: teamId("UM Laut"), detail: "Yellow card: #4", minuteLabel: "60'" });
    const snap = getLiveSnapshot();
    expect(snap.version).toBeGreaterThan(v0);
    expect(snap.events.some((e) => e.match_id === m && e.minute_label === "60'")).toBe(true);
    expect(snap.matches.find((x) => x.id === m)?.team_a?.short_name).toBe("UM Laut");
    expect(() => addEvent(aina, m, { kind: "goal", team: teamId("UKM Laut"), detail: "", minuteLabel: "1'" })).toThrow(RuleError);
  });
});
