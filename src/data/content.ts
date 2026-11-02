import { getDb, tx, uuid, nowIso, plain } from "./db.ts";
import { writeAudit, bumpLive } from "./audit.ts";
import { requireAdmin, RuleError } from "./matches.ts";
import type { SessionUser } from "../domain/types.ts";

export type AnnouncementRow = { id: string; title: string; body: string; lang: "en" | "bm"; published: boolean; updated_at: string };

export function listAllAnnouncements(): AnnouncementRow[] {
  return plain<Omit<AnnouncementRow, "published"> & { published: number }>(getDb().prepare("SELECT * FROM announcements ORDER BY updated_at DESC").all())
    .map((a) => ({ ...a, published: !!a.published }));
}

export function saveAnnouncement(user: SessionUser, a: { id?: string; title: string; body: string; lang: string; published: boolean }) {
  const db = getDb();
  return tx(db, () => {
    const me = requireAdmin(db, user);
    const title = a.title.trim().slice(0, 120), body = a.body.trim().slice(0, 1000);
    if (!title || !body) throw new RuleError("An announcement needs a title and a message.");
    if (a.lang !== "en" && a.lang !== "bm") throw new RuleError("Choose English or Bahasa Melayu.");
    const before = a.id ? db.prepare("SELECT * FROM announcements WHERE id = ?").get(a.id) : undefined;
    const id = a.id && before ? a.id : uuid();
    if (before) db.prepare("UPDATE announcements SET title=?, body=?, lang=?, published=?, updated_at=? WHERE id=?").run(title, body, a.lang, a.published ? 1 : 0, nowIso(), id);
    else db.prepare("INSERT INTO announcements VALUES (?,?,?,?,?,?)").run(id, title, body, a.lang, a.published ? 1 : 0, nowIso());
    writeAudit(db, { userId: me.id, action: before ? "announcement_update" : "announcement_create", before, after: { id, title, lang: a.lang, published: a.published } });
    bumpLive(db);
    return { id };
  });
}

export function deleteAnnouncement(user: SessionUser, id: string) {
  const db = getDb();
  return tx(db, () => {
    const me = requireAdmin(db, user);
    const before = db.prepare("SELECT * FROM announcements WHERE id = ?").get(id);
    db.prepare("DELETE FROM announcements WHERE id = ?").run(id);
    writeAudit(db, { userId: me.id, action: "announcement_delete", before });
    bumpLive(db);
  });
}
