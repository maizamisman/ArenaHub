// Writes a fresh, seeded data/arenahub.db (or $ARENAHUB_DB) and prints the sample logins.
// Usage: npm run db:reset [-- --fresh-2fa]
import fs from "node:fs";
import { openDb, defaultDbFile, uploadDir } from "../src/data/db.ts";
import { seed, DEFAULT_LOGINS } from "../src/data/seed.ts";

const file = defaultDbFile();
for (const f of [file, `${file}-wal`, `${file}-shm`]) fs.rmSync(f, { force: true });
fs.rmSync(uploadDir(), { recursive: true, force: true });

const db = openDb(file);
const fresh2fa = process.argv.includes("--fresh-2fa");
const { adminTotpSecret } = seed(db, {
  adminPassword: DEFAULT_LOGINS.adminPassword,
  picPassword: DEFAULT_LOGINS.picPassword,
  adminTotpSecret: fresh2fa ? null : process.env.ARENAHUB_TOTP_SECRET || undefined,
});
db.close();

console.log(`Database ready: ${file}\n`);
console.log("Sample logins (local testing only):");
console.log(`  Admin  ${DEFAULT_LOGINS.adminEmail} / ${DEFAULT_LOGINS.adminPassword}`);
console.log(adminTotpSecret
  ? `         2FA secret ${adminTotpSecret} (add it to an authenticator app)`
  : "         2FA is set up on first sign-in (QR code shown)");
console.log(`  PIC    aina@arenahub.my / ${DEFAULT_LOGINS.picPassword} (must change on first sign-in)`);
console.log(`  PIC    danial@arenahub.my / ${DEFAULT_LOGINS.picPassword} (must change on first sign-in)`);
console.log("  PIC    meiling@arenahub.my (inactive)");
