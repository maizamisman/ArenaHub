import fs from "node:fs";
import path from "node:path";
import { getDb, tx, uploadDir, uuid } from "./db.ts";
import { getSettings } from "./settings.ts";
import { countRecent, record } from "../auth/rate-limit.ts";
import { bumpLive } from "./audit.ts";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const MAX_CAPTION = 200;
const HOUR = 3_600_000;
const PER_DEVICE = 5;
const PER_IP = 20;
const HIDE_AT_REPORTS = 3;

type Kind = { ext: "jpg" | "png" | "webp"; mime: string };

/** Identifies the image type from the file's first bytes, never from its name. */
export function sniffImage(b: Uint8Array): Kind | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { ext: "jpg", mime: "image/jpeg" };
  if (b.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((x, i) => b[i] === x)) return { ext: "png", mime: "image/png" };
  if (b.length >= 12 && String.fromCharCode(...b.slice(0, 4)) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP") return { ext: "webp", mime: "image/webp" };
  return null;
}

export const MIME: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };

export type UploadResult = { ok: true; status: "live" | "pending" } | { ok: false; error: string };

/** Every check runs before anything is written, so a refused upload leaves nothing on disk. */
export function uploadPhoto(input: { bytes: Uint8Array; caption: string; consent: boolean; deviceHash: string; ip: string; nowMs?: number }): UploadResult {
  const db = getDb();
  const now = input.nowMs ?? Date.now();
  if (!input.consent) return { ok: false, error: "Please agree to the privacy notice before posting." };
  if (input.bytes.byteLength > MAX_UPLOAD_BYTES) return { ok: false, error: "That photo is over 10 MB. Choose a smaller one." };
  const kind = sniffImage(input.bytes);
  if (!kind) return { ok: false, error: "That file is not a photo. Use a JPG, PNG or WebP image." };
  const caption = (input.caption ?? "").trim();
  if (caption.length > MAX_CAPTION) return { ok: false, error: `Keep the description under ${MAX_CAPTION} characters.` };
  if (countRecent(db, `upload:dev:${input.deviceHash}`, HOUR, now) >= PER_DEVICE || countRecent(db, `upload:ip:${input.ip}`, HOUR, now) >= PER_IP) {
    return { ok: false, error: "You have posted a lot in the last hour. Please try again later." };
  }

  const status = getSettings(db).photo_approval === "approval" ? "pending" : "live";
  const id = uuid();
  const file = `${id}.${kind.ext}`;
  const dir = uploadDir();
  fs.mkdirSync(dir, { recursive: true });
  const full = path.join(/* turbopackIgnore: true */ dir, file);
  fs.writeFileSync(full, input.bytes);
  try {
    tx(db, () => {
      db.prepare("INSERT INTO photos (id, file, caption, created_at, status, by_admin, device_hash, reports) VALUES (?,?,?,?,?,0,?,0)")
        .run(id, file, caption, new Date(now).toISOString(), status, input.deviceHash);
      record(db, `upload:dev:${input.deviceHash}`, now);
      record(db, `upload:ip:${input.ip}`, now);
      bumpLive(db);
    });
  } catch (e) {
    fs.rmSync(full, { force: true });
    throw e;
  }
  return { ok: true, status };
}

export function likePhoto(photoId: string, deviceHash: string): { likes: number; liked: true } {
  const db = getDb();
  db.prepare("INSERT OR IGNORE INTO photo_likes (photo_id, device_hash) SELECT id, ? FROM photos WHERE id = ? AND status = 'live'").run(deviceHash, photoId);
  return { likes: likeCount(photoId), liked: true };
}

export function unlikePhoto(photoId: string, deviceHash: string): { likes: number; liked: false } {
  getDb().prepare("DELETE FROM photo_likes WHERE photo_id = ? AND device_hash = ?").run(photoId, deviceHash);
  return { likes: likeCount(photoId), liked: false };
}

function likeCount(photoId: string): number {
  return (getDb().prepare("SELECT COUNT(*) AS n FROM photo_likes WHERE photo_id = ?").get(photoId) as { n: number }).n;
}

/** One report per device; at three, a live post goes back to review. */
export function reportPhoto(photoId: string, deviceHash: string): { ok: boolean } {
  const db = getDb();
  return tx(db, () => {
    const key = `report:${photoId}:${deviceHash}`;
    if (countRecent(db, key, 365 * 24 * HOUR) > 0) return { ok: true };
    const r = db.prepare("UPDATE photos SET reports = reports + 1 WHERE id = ? AND status != 'removed'").run(photoId);
    if (r.changes === 0) return { ok: false };
    record(db, key);
    db.prepare(`UPDATE photos SET status = 'pending' WHERE id = ? AND status = 'live' AND reports >= ${HIDE_AT_REPORTS}`).run(photoId);
    bumpLive(db);
    return { ok: true };
  });
}

export type PublicPhoto = { id: string; src: string; caption: string; created_at: string; by_admin: boolean; likes: number; liked: boolean; mine: boolean };

export function listPublicPhotos(deviceHash: string, sort: "new" | "loved" = "new"): PublicPhoto[] {
  const rows = getDb().prepare(
    `SELECT p.id, p.file, p.caption, p.created_at, p.by_admin, p.device_hash,
            (SELECT COUNT(*) FROM photo_likes l WHERE l.photo_id = p.id) AS likes,
            EXISTS (SELECT 1 FROM photo_likes l WHERE l.photo_id = p.id AND l.device_hash = ?) AS liked
     FROM photos p WHERE p.status = 'live'
     ORDER BY ${sort === "loved" ? "likes DESC, p.created_at DESC" : "p.created_at DESC"}`,
  ).all(deviceHash) as { id: string; file: string; caption: string; created_at: string; by_admin: number; device_hash: string; likes: number; liked: number }[];
  return rows.map((r) => ({
    id: r.id, src: `/uploads/${r.file}`, caption: r.caption, created_at: r.created_at,
    by_admin: !!r.by_admin, likes: r.likes, liked: !!r.liked, mine: r.device_hash === deviceHash,
  }));
}

/** Reads a stored upload by file name; names are validated so paths can't escape the folder. */
export function readUpload(file: string): { bytes: Buffer; mime: string } | null {
  const m = /^[0-9a-f-]{36}\.(jpg|png|webp)$/.exec(file);
  if (!m) return null;
  const full = path.join(/* turbopackIgnore: true */ uploadDir(), file);
  if (!fs.existsSync(full)) return null;
  return { bytes: fs.readFileSync(full), mime: MIME[m[1]] };
}
