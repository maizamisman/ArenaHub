import { describe, it, expect, beforeEach } from "vitest";
import { openDb, setDb } from "@/data/db";
import { seed } from "@/data/seed";
import { totpNow, verifyTotp } from "@/auth/totp";
import { login, sessionUserFromId, completeMfa } from "@/auth/session";
import { checkAccess } from "@/auth/guard";
import type { DatabaseSync } from "node:sqlite";

const SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
let db: DatabaseSync;

beforeEach(() => {
  db = openDb(":memory:");
  seed(db, { adminPassword: "admin-pass-123", picPassword: "pic-pass-1234", adminTotpSecret: SECRET, copyPhotos: false });
  setDb(db);
});

describe("totp", () => {
  it("TOTP matches RFC 6238 vector", () => {
    expect(totpNow(SECRET, 59_000)).toBe("287082");
  });

  it("code from the previous step is accepted, two steps old is not", () => {
    const t = 1_800_000_000_000;
    expect(verifyTotp(SECRET, totpNow(SECRET, t), t)).toBe(true);
    expect(verifyTotp(SECRET, totpNow(SECRET, t - 30_000), t)).toBe(true);
    expect(verifyTotp(SECRET, totpNow(SECRET, t - 60_000), t)).toBe(false);
    expect(verifyTotp(SECRET, "12345", t)).toBe(false);
  });
});

describe("sessions", () => {
  it("deactivated user's session is rejected", () => {
    const r = login("aina@arenahub.my", "pic-pass-1234");
    if (!r.ok) throw new Error(r.error);
    expect(r.mustChange).toBe(true);
    expect(sessionUserFromId(r.sessionId)?.name).toBe("Aina Sofea");
    db.prepare("UPDATE users SET active=0 WHERE email='aina@arenahub.my'").run();
    expect(sessionUserFromId(r.sessionId)).toBeNull();
  });

  it("inactive account cannot sign in and gets the same message", () => {
    const r = login("meiling@arenahub.my", "pic-pass-1234");
    expect(r).toEqual({ ok: false, error: "Email or password is incorrect." });
  });

  it("admin session without mfa cannot reach admin", () => {
    const r = login("admin@arenahub.my", "admin-pass-123");
    if (!r.ok) throw new Error(r.error);
    expect(r.needsMfa).toBe(true);
    const before = sessionUserFromId(r.sessionId)!;
    expect(checkAccess(before, "admin")).toBe("mfa");
    const now = Date.now();
    expect(completeMfa(r.sessionId, "000000", now)).toBe(false);
    expect(completeMfa(r.sessionId, totpNow(SECRET, now), now)).toBe(true);
    expect(checkAccess(sessionUserFromId(r.sessionId), "admin")).toBe("ok");
    expect(checkAccess(sessionUserFromId(r.sessionId), "pic")).toBe("forbidden");
    expect(checkAccess(sessionUserFromId(r.sessionId), "staff")).toBe("ok");
    expect(checkAccess(null, "staff")).toBe("login");
  });

  it("sixth wrong attempt is locked", () => {
    for (let i = 0; i < 5; i++) {
      expect(login("danial@arenahub.my", "wrong")).toEqual({ ok: false, error: "Email or password is incorrect." });
    }
    const sixth = login("danial@arenahub.my", "pic-pass-1234");
    expect(sixth.ok).toBe(false);
    if (!sixth.ok) expect(sixth.error).toMatch(/Too many attempts/);
    expect(login("aina@arenahub.my", "pic-pass-1234").ok).toBe(true);
  });
});
