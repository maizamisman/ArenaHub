import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { uploadPhoto, likePhoto, reportPhoto, MAX_UPLOAD_BYTES } from "@/data/photos";
import { freshDb } from "./helpers";

// Smallest valid-looking files: magic bytes plus padding.
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, ...new Array(64).fill(1)]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...new Array(64).fill(1)]);
const TEXT = new TextEncoder().encode("MZ this is really a program, renamed to .jpg");

let db: DatabaseSync;
let dir: string;
const files = () => fs.readdirSync(dir);
const ok = (over: Partial<Parameters<typeof uploadPhoto>[0]> = {}) =>
  uploadPhoto({ bytes: JPEG, caption: "Nice", consent: true, deviceHash: "dev1", ip: "10.0.0.1", ...over });

beforeEach(() => {
  db = freshDb();
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "ah-up-"));
  process.env.ARENAHUB_UPLOADS = dir;
});

describe("photos upload", () => {
  it("accepts a JPEG or PNG with consent", () => {
    expect(ok()).toEqual({ ok: true, status: "live" });
    expect(ok({ bytes: PNG, deviceHash: "dev2" })).toEqual({ ok: true, status: "live" });
    expect(files()).toHaveLength(2);
  });

  it("rejects a non-image renamed .jpg", () => {
    const r = ok({ bytes: TEXT });
    expect(r).toEqual({ ok: false, error: expect.stringMatching(/JPG, PNG or WebP/) });
  });

  it("rejects over 10 MB", () => {
    const big = new Uint8Array(MAX_UPLOAD_BYTES + 1);
    big.set(JPEG);
    expect(ok({ bytes: big })).toEqual({ ok: false, error: expect.stringMatching(/10 MB/) });
  });

  it("rejects without consent", () => {
    expect(ok({ consent: false })).toEqual({ ok: false, error: expect.stringMatching(/consent|agree/i) });
  });

  it("rejects a caption over 200 characters", () => {
    expect(ok({ caption: "x".repeat(201) }).ok).toBe(false);
  });

  it("rejects the sixth upload in an hour", () => {
    for (let i = 0; i < 5; i++) expect(ok().ok).toBe(true);
    expect(ok()).toEqual({ ok: false, error: expect.stringMatching(/hour/) });
    expect(ok({ deviceHash: "other" }).ok).toBe(true);
  });

  it("limits 20 uploads per IP in an hour", () => {
    for (let i = 0; i < 20; i++) expect(ok({ deviceHash: `d${i}` }).ok).toBe(true);
    expect(ok({ deviceHash: "fresh" }).ok).toBe(false);
  });

  it("writes no file when rejected", () => {
    ok({ bytes: TEXT });
    ok({ consent: false });
    const big = new Uint8Array(MAX_UPLOAD_BYTES + 1); big.set(JPEG);
    ok({ bytes: big });
    expect(files()).toHaveLength(0);
    expect((db.prepare("SELECT COUNT(*) n FROM photos WHERE device_hash = 'dev1'").get() as { n: number }).n).toBe(0);
  });

  it("goes to pending when approval is switched on", () => {
    db.prepare("UPDATE settings SET value = ? WHERE key = 'photo_approval'").run(JSON.stringify("approval"));
    expect(ok()).toEqual({ ok: true, status: "pending" });
  });

  it("like twice from one device counts once", () => {
    const p = (db.prepare("SELECT id FROM photos LIMIT 1").get() as { id: string }).id;
    expect(likePhoto(p, "devA").likes).toBe(1);
    expect(likePhoto(p, "devA").likes).toBe(1);
    expect(likePhoto(p, "devB").likes).toBe(2);
  });

  it("three reports hide a post", () => {
    const p = (db.prepare("SELECT id FROM photos LIMIT 1").get() as { id: string }).id;
    reportPhoto(p, "r1");
    reportPhoto(p, "r1"); // the same device again does not count
    reportPhoto(p, "r2");
    expect((db.prepare("SELECT status FROM photos WHERE id = ?").get(p) as { status: string }).status).toBe("live");
    reportPhoto(p, "r3");
    expect((db.prepare("SELECT status, reports FROM photos WHERE id = ?").get(p) as { status: string; reports: number })).toEqual({ status: "pending", reports: 3 });
  });
});
