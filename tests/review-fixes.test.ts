import { describe, it, expect, beforeEach, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { applyScoreDelta, setStatus, correctScore, undoLast, reopenMatch, RuleError, type LiveSnapshot } from "@/data/matches";
import { login, completeMfa, sessionUserFromId, changePassword } from "@/auth/session";
import { canChangePassword } from "@/auth/guard";
import { totpNow } from "@/auth/totp";
import { createLivePoller } from "@/lib/livePoller";
import { scoreView } from "@/lib/scoreView";
import { withRetry } from "@/lib/retry";
import { stripMetadata, uploadPhoto } from "@/data/photos";
import { freshDb, userByEmail, matchId, SECRET } from "./helpers";

let db: DatabaseSync;
beforeEach(() => { db = freshDb(); });
const rid = () => crypto.randomUUID();

describe("review fixes", () => {
  it("re-finishing a reopened semi-final cannot rewrite a final that has started", () => {
    const admin = userByEmail(db, "admin@arenahub.my");
    const sf1 = matchId(db, "UM Laut", "UKM Laut", "Semi-final 1");
    const final = matchId(db, "UM Laut", "UMT Laut", "Final");
    reopenMatch(admin, sf1, "Score typed wrong");
    correctScore(admin, sf1, 1, 2, "Referee sheet");
    expect(() => setStatus(admin, sf1, "full_time")).toThrow(/next round/i);
    const f = db.prepare("SELECT t.short_name s FROM matches m JOIN teams t ON t.id = m.team_a WHERE m.id = ?").get(final) as { s: string };
    expect(f.s).toBe("UM Laut");
  });

  it("2FA locks after five wrong codes and ends the session", () => {
    const r = login("admin@arenahub.my", "admin-pass-123");
    if (!r.ok) throw new Error(r.error);
    const now = Date.now();
    const good = totpNow(SECRET, now);
    const bad = String((Number(good) + 500_000) % 1_000_000).padStart(6, "0");
    for (let i = 0; i < 5; i++) expect(completeMfa(r.sessionId, bad, now)).toBe(false);
    expect(completeMfa(r.sessionId, good, now)).toBe(false);
    expect(sessionUserFromId(r.sessionId)).toBeNull();
  });

  it("an Admin who has not passed 2FA cannot change the password", () => {
    const r = login("admin@arenahub.my", "admin-pass-123");
    if (!r.ok) throw new Error(r.error);
    expect(canChangePassword(sessionUserFromId(r.sessionId))).toBe(false);
    const a = login("aina@arenahub.my", "pic-pass-1234");
    if (!a.ok) throw new Error(a.error);
    expect(canChangePassword(sessionUserFromId(a.sessionId))).toBe(true);
  });

  it("changing a password ends the user's other sessions", () => {
    const s1 = login("aina@arenahub.my", "pic-pass-1234");
    const s2 = login("aina@arenahub.my", "pic-pass-1234");
    if (!s1.ok || !s2.ok) throw new Error("login");
    const aina = userByEmail(db, "aina@arenahub.my");
    expect(changePassword(aina.id, "pic-pass-1234", "a-much-better-pass", s1.sessionId).ok).toBe(true);
    expect(sessionUserFromId(s1.sessionId)).not.toBeNull();
    expect(sessionUserFromId(s2.sessionId)).toBeNull();
  });

  it("undo is refused after someone else corrected the score", () => {
    const aina = userByEmail(db, "aina@arenahub.my");
    const admin = userByEmail(db, "admin@arenahub.my");
    const m = matchId(db, "UM Laut", "UMT Laut", "Final");
    applyScoreDelta(aina, m, "a", 1, rid());
    correctScore(admin, m, 2, 1, "Goal disallowed");
    expect(() => undoLast(aina, m)).toThrow(RuleError);
    expect((db.prepare("SELECT score_a FROM matches WHERE id = ?").get(m) as { score_a: number }).score_a).toBe(2);
  });

  it("the poller publishes the server clock offset before its first poll", () => {
    const onChange = vi.fn();
    const ev = { visibilityState: "visible", addEventListener() {}, removeEventListener() {} };
    const serverNow = new Date(Date.now() - 5 * 60_000).toISOString(); // phone 5 minutes fast
    const snap: LiveSnapshot = { serverNow, version: 1, matches: [], events: [] };
    const p = createLivePoller({ initial: snap, onChange, fetchFn: async () => new Response("{}"), doc: ev, win: ev });
    p.start();
    expect(onChange).toHaveBeenCalled();
    expect(onChange.mock.calls[0][0].offsetMs).toBeLessThan(-299_000);
    p.stop();
  });

  it("the score screen never shows an older score than polling has", () => {
    const confirmed = { version: 3, score_a: 3, score_b: 0 };
    const polled = { version: 5, score_a: 5, score_b: 0 };
    expect(scoreView(confirmed, polled, { a: 1, b: 0 })).toMatchObject({ score_a: 6, score_b: 0, version: 5 });
    expect(scoreView(polled, confirmed, { a: 0, b: 0 })).toMatchObject({ score_a: 5 });
  });

  it("a lost reply is retried with the same request id", async () => {
    const seen: string[] = [];
    let n = 0;
    const out = await withRetry(async () => { seen.push("r1"); if (++n < 3) throw new Error("net"); return "ok"; }, { attempts: 3, delayMs: 1 });
    expect(out).toBe("ok");
    expect(seen).toEqual(["r1", "r1", "r1"]);
    await expect(withRetry(async () => { throw new Error("down"); }, { attempts: 2, delayMs: 1 })).rejects.toThrow("down");
  });

  it("photo location metadata is removed before saving", () => {
    const exif = Buffer.concat([Buffer.from("Exif\0\0"), Buffer.from("GPS 3.0006 101.39")]);
    const app1 = Buffer.concat([Buffer.from([0xff, 0xe1]), Buffer.from([0, exif.length + 2]), exif]);
    const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8]), app1, Buffer.from([0xff, 0xda, 0, 2, 1, 2, 3, 0xff, 0xd9])]);
    const clean = Buffer.from(stripMetadata(new Uint8Array(jpeg)));
    expect(clean.includes(Buffer.from("GPS"))).toBe(false);
    expect(clean.subarray(0, 2).toString("hex")).toBe("ffd8");
    expect(clean.includes(Buffer.from([0xff, 0xda]))).toBe(true);

    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ah-exif-"));
    process.env.ARENAHUB_UPLOADS = dir;
    expect(uploadPhoto({ bytes: new Uint8Array(jpeg), caption: "", consent: true, deviceHash: "d", ip: "i" }).ok).toBe(true);
    const saved = fs.readFileSync(path.join(dir, fs.readdirSync(dir)[0]));
    expect(saved.includes(Buffer.from("GPS"))).toBe(false);
  });
});
