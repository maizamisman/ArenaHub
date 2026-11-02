import fs from "node:fs";
import path from "node:path";
import { getDb, uploadDir, uuid } from "./db.ts";
import { sniffImage } from "./photos.ts";
import { saveSettings } from "./settings.ts";
import { RuleError } from "./matches.ts";
import type { SessionUser } from "../domain/types.ts";

const MAX_LOGO = 2 * 1024 * 1024;

/** Stores an event logo (JPEG, PNG or WebP, up to 2 MB) and points the settings at it. */
export function saveLogo(user: SessionUser, bytes: Uint8Array): string {
  getDb();
  const kind = sniffImage(bytes);
  if (!kind) throw new RuleError("The logo must be a JPG, PNG or WebP image.");
  if (bytes.byteLength > MAX_LOGO) throw new RuleError("The logo must be 2 MB or smaller.");
  const file = `${uuid()}.${kind.ext}`;
  fs.mkdirSync(uploadDir(), { recursive: true });
  fs.writeFileSync(path.join(/* turbopackIgnore: true */ uploadDir(), file), bytes);
  try {
    saveSettings(user, { logo_path: `/uploads/${file}` });
  } catch (e) {
    fs.rmSync(path.join(/* turbopackIgnore: true */ uploadDir(), file), { force: true });
    throw e;
  }
  return file;
}
