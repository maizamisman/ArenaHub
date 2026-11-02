import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { saveMatch, deleteTeam, saveTeam } from "@/data/catalog";
import { createPic, setPicActive, setAssignments } from "@/data/people";
import { saveSettings, getSettings, moduleOn } from "@/data/settings";
import { exportBackup, readZipNames } from "@/data/backup";
import { applyScoreDelta, ForbiddenError, RuleError, listMatchesFor } from "@/data/matches";
import { login, sessionUserFromId } from "@/auth/session";
import { freshDb, userByEmail, matchId } from "../helpers";

let db: DatabaseSync;
let admin: ReturnType<typeof userByEmail>;
const teamId = (s: string) => (db.prepare("SELECT id FROM teams WHERE short_name = ?").get(s) as { id: string }).id;
const one = (sql: string, ...a: string[]) => db.prepare(sql).get(...a) as Record<string, unknown>;

beforeEach(() => {
  db = freshDb();
  admin = userByEmail(db, "admin@arenahub.my");
});

describe("admin data", () => {
  it("cannot create a second admin", () => {
    expect(() => db.prepare("INSERT INTO users VALUES ('x','second@arenahub.my','Second','admin','h',0,NULL,1,'2027-01-01')").run()).toThrow();
    const { tempPassword } = createPic(admin, { name: "New Person", email: "new@arenahub.my" });
    expect(tempPassword.length).toBeGreaterThanOrEqual(10);
    expect(one("SELECT role, must_change_password FROM users WHERE email = 'new@arenahub.my'")).toEqual({ role: "pic", must_change_password: 1 });
    expect(() => createPic(admin, { name: "Dup", email: "ADMIN@arenahub.my" })).toThrow(RuleError);
    const aina = userByEmail(db, "aina@arenahub.my");
    expect(() => createPic(aina, { name: "Sneaky", email: "s@arenahub.my" })).toThrow(ForbiddenError);
  });

  it("cannot delete a team that still has matches", () => {
    expect(() => deleteTeam(admin, teamId("UM Laut"))).toThrow(/matches/);
    const t = saveTeam(admin, { short_name: "UNIMAS Laut", institution: "Universiti Malaysia Sarawak", manager: "", active: true });
    deleteTeam(admin, t.id);
    expect(db.prepare("SELECT 1 FROM teams WHERE id = ?").get(t.id)).toBeUndefined();
    expect(one("SELECT COUNT(*) n FROM audit_log WHERE action = 'team_delete'")).toEqual({ n: 1 });
  });

  it("rejects a match where a team plays itself", () => {
    const sport = (one("SELECT id FROM sports WHERE name = 'Football'") as { id: string }).id;
    const court = (one("SELECT id FROM courts WHERE name = 'Main Field'") as { id: string }).id;
    expect(() => saveMatch(admin, { sport_id: sport, round: "Friendly", team_a: teamId("UM Laut"), team_b: teamId("UM Laut"), court_id: court, starts_at: "2027-03-12T01:00:00.000Z" })).toThrow(/itself/);
  });

  it("rejects two matches on one court at the same time", () => {
    const sport = (one("SELECT id FROM sports WHERE name = 'Football'") as { id: string }).id;
    const court = (one("SELECT id FROM courts WHERE name = 'Main Field'") as { id: string }).id;
    const final = one("SELECT starts_at FROM matches WHERE id = ?", matchId(db, "UM Laut", "UMT Laut", "Final")) as { starts_at: string };
    expect(() => saveMatch(admin, { sport_id: sport, round: "Friendly", team_a: teamId("UKM Laut"), team_b: teamId("UPM Laut"), court_id: court, starts_at: final.starts_at })).toThrow(/court/);
    const ok = saveMatch(admin, { sport_id: sport, round: "Friendly", team_a: teamId("UKM Laut"), team_b: teamId("UPM Laut"), court_id: court, starts_at: "2027-03-12T01:00:00.000Z" });
    expect(ok.status).toBe("upcoming");
  });

  it("deactivating a PIC ends their access", () => {
    const r = login("aina@arenahub.my", "pic-pass-1234");
    if (!r.ok) throw new Error(r.error);
    const aina = userByEmail(db, "aina@arenahub.my");
    setPicActive(admin, aina.id, false);
    expect(sessionUserFromId(r.sessionId)).toBeNull();
    expect(() => applyScoreDelta(aina, matchId(db, "UM Laut", "UMT Laut", "Final"), "a", 1, crypto.randomUUID())).toThrow(ForbiddenError);
    expect(login("aina@arenahub.my", "pic-pass-1234").ok).toBe(false);
  });

  it("assignments decide which matches a PIC sees", () => {
    const { tempPassword } = createPic(admin, { name: "Faris", email: "faris@arenahub.my" });
    expect(tempPassword).toBeTruthy();
    const faris = userByEmail(db, "faris@arenahub.my");
    expect(listMatchesFor(faris)).toHaveLength(0);
    const court = (one("SELECT id FROM courts WHERE name = 'Netball Court'") as { id: string }).id;
    setAssignments(admin, faris.id, { matchIds: [matchId(db, "UM Laut", "UMT Laut", "Final")], courtIds: [court] });
    const seen = listMatchesFor(faris).map((m) => m.round + " " + m.sport.name).sort();
    expect(seen).toEqual(["Final Football", "Final Netball", "Semi-final 1 Netball", "Semi-final 2 Netball", "Third place Netball"]);
  });

  it("turning off photos hides the public page", () => {
    expect(moduleOn("photos")).toBe(true);
    saveSettings(admin, { modules: { ...getSettings().modules, photos: false } });
    expect(moduleOn("photos")).toBe(false);
    expect(getSettings().modules.standings).toBe(true);
    expect(() => saveSettings(admin, { theme_colour: "red; background:url(x)" })).toThrow(RuleError);
    expect(one("SELECT COUNT(*) n FROM audit_log WHERE action = 'settings'")).toEqual({ n: 1 });
  });

  it("backup contains the database and uploads", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ah-bk-"));
    process.env.ARENAHUB_UPLOADS = dir;
    fs.writeFileSync(path.join(dir, "11111111-1111-1111-1111-111111111111.jpg"), Buffer.from([0xff, 0xd8, 0xff, 0]));
    const zip = exportBackup();
    expect(zip.subarray(0, 4).toString("hex")).toBe("504b0304");
    const names = readZipNames(zip);
    expect(names).toContain("arenahub.db");
    expect(names).toContain("uploads/11111111-1111-1111-1111-111111111111.jpg");
  });
});
