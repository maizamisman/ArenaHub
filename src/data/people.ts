import { randomInt } from "node:crypto";
import { getDb, tx, uuid, nowIso, plain } from "./db.ts";
import { writeAudit } from "./audit.ts";
import { requireAdmin, RuleError } from "./matches.ts";
import { hashPassword } from "../auth/password.ts";
import type { SessionUser } from "../domain/types.ts";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// No look-alike characters (0/O, 1/l/I), so a temporary password can be read out loud.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";

function tempPassword(): string {
  return Array.from({ length: 12 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
}

export type PicRow = { id: string; name: string; email: string; active: boolean; must_change_password: boolean; matchIds: string[]; courtIds: string[] };

export function listPics(): PicRow[] {
  const db = getDb();
  const users = plain<{ id: string; name: string; email: string; active: number; must_change_password: number }>(
    db.prepare("SELECT id, name, email, active, must_change_password FROM users WHERE role = 'pic' ORDER BY name").all());
  const asg = plain<{ user_id: string; match_id: string | null; court_id: string | null }>(db.prepare("SELECT * FROM assignments").all());
  return users.map((u) => ({
    ...u, active: !!u.active, must_change_password: !!u.must_change_password,
    matchIds: asg.filter((a) => a.user_id === u.id && a.match_id).map((a) => a.match_id!),
    courtIds: asg.filter((a) => a.user_id === u.id && a.court_id).map((a) => a.court_id!),
  }));
}

/** Creates a PIC with a temporary password they must change on first sign-in. There is no way to create an Admin. */
export function createPic(admin: SessionUser, p: { name: string; email: string }): { id: string; tempPassword: string } {
  const db = getDb();
  return tx(db, () => {
    const me = requireAdmin(db, admin);
    const name = p.name.trim().slice(0, 80);
    const email = p.email.trim().toLowerCase();
    if (!name) throw new RuleError("Name is required.");
    if (!EMAIL.test(email)) throw new RuleError("Enter a valid email address.");
    if (db.prepare("SELECT 1 FROM users WHERE email = ?").get(email)) throw new RuleError("An account with that email already exists.");
    const id = uuid();
    const pw = tempPassword();
    db.prepare("INSERT INTO users VALUES (?,?,?,'pic',?,1,NULL,1,?)").run(id, email, name, hashPassword(pw), nowIso());
    writeAudit(db, { userId: me.id, action: "pic_create", after: { id, name, email } });
    return { id, tempPassword: pw };
  });
}

export function updatePic(admin: SessionUser, id: string, p: { name: string; email: string }) {
  const db = getDb();
  return tx(db, () => {
    const me = requireAdmin(db, admin);
    const before = db.prepare("SELECT name, email FROM users WHERE id = ? AND role = 'pic'").get(id);
    if (!before) throw new RuleError("That PIC does not exist.");
    const email = p.email.trim().toLowerCase();
    if (!EMAIL.test(email)) throw new RuleError("Enter a valid email address.");
    if (db.prepare("SELECT 1 FROM users WHERE email = ? AND id != ?").get(email, id)) throw new RuleError("An account with that email already exists.");
    db.prepare("UPDATE users SET name = ?, email = ? WHERE id = ?").run(p.name.trim().slice(0, 80), email, id);
    writeAudit(db, { userId: me.id, action: "pic_update", before, after: { name: p.name, email } });
  });
}

/** New temporary password; the PIC must change it, and existing sessions end. */
export function resetPicPassword(admin: SessionUser, id: string): { tempPassword: string } {
  const db = getDb();
  return tx(db, () => {
    const me = requireAdmin(db, admin);
    if (!db.prepare("SELECT 1 FROM users WHERE id = ? AND role = 'pic'").get(id)) throw new RuleError("That PIC does not exist.");
    const pw = tempPassword();
    db.prepare("UPDATE users SET password_hash = ?, must_change_password = 1 WHERE id = ?").run(hashPassword(pw), id);
    db.prepare("DELETE FROM sessions WHERE user_id = ?").run(id);
    writeAudit(db, { userId: me.id, action: "pic_password_reset", after: { id } });
    return { tempPassword: pw };
  });
}

/** Deactivating signs the PIC out everywhere at once. */
export function setPicActive(admin: SessionUser, id: string, active: boolean) {
  const db = getDb();
  return tx(db, () => {
    const me = requireAdmin(db, admin);
    const r = db.prepare("UPDATE users SET active = ? WHERE id = ? AND role = 'pic'").run(active ? 1 : 0, id);
    if (r.changes === 0) throw new RuleError("That PIC does not exist.");
    if (!active) db.prepare("DELETE FROM sessions WHERE user_id = ?").run(id);
    writeAudit(db, { userId: me.id, action: active ? "pic_activate" : "pic_deactivate", after: { id } });
  });
}

export function setAssignments(admin: SessionUser, picId: string, a: { matchIds: string[]; courtIds: string[] }) {
  const db = getDb();
  return tx(db, () => {
    const me = requireAdmin(db, admin);
    if (!db.prepare("SELECT 1 FROM users WHERE id = ? AND role = 'pic'").get(picId)) throw new RuleError("That PIC does not exist.");
    const before = db.prepare("SELECT match_id, court_id FROM assignments WHERE user_id = ?").all(picId);
    db.prepare("DELETE FROM assignments WHERE user_id = ?").run(picId);
    for (const m of new Set(a.matchIds)) db.prepare("INSERT INTO assignments VALUES (?,?,NULL)").run(picId, m);
    for (const c of new Set(a.courtIds)) db.prepare("INSERT INTO assignments VALUES (?,NULL,?)").run(picId, c);
    writeAudit(db, { userId: me.id, action: "assignments", before, after: { picId, ...a } });
  });
}
