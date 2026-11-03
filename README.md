# ArenaHub

Live scores, standings, schedule and photos for Karnival Sukan KD Sri Klang 2027, organised by PALAPES Laut Universiti Malaya.

Phase 1 runs on this computer with local storage. Students, PICs and the Admin use the same website:

| Who | Where | Sign in |
|---|---|---|
| Public (students, spectators) | `/` | No |
| PIC (person in charge of a match) | `/staff/pic` | Email and password |
| Admin | `/staff/admin` | Email, password and an authenticator app code |

## What you need

- Node.js 24 or newer (`node --version`).
- Nothing else. The database is SQLite built into Node; photos are files in `data/uploads/`.

## Run it

```bash
npm install          # first time only
npm run db:reset     # creates data/arenahub.db with sample data and prints the logins
npm run dev          # development, reloads on code changes
```

Open <http://localhost:3000>.

For a faster, production-like run:

```bash
npm run build
npm start
```

Both bind to every network address, so phones on the same Wi-Fi can open the site (see below).

## Sample logins

`npm run db:reset` prints these. They are for local testing only.

| Account | Email | Password |
|---|---|---|
| Admin | `admin@arenahub.my` | `ArenaHub-Admin-2027` |
| PIC | `aina@arenahub.my` | `ArenaHub-Pic-2027` (must be changed at first sign-in) |
| PIC | `danial@arenahub.my` | `ArenaHub-Pic-2027` (must be changed at first sign-in) |
| PIC, inactive | `meiling@arenahub.my` | cannot sign in |

The Admin's two-step code: `db:reset` prints a 2FA secret. Add it to Google Authenticator or Microsoft Authenticator ("enter a setup key", time-based) and type the 6-digit code it shows. To set 2FA up from a QR code instead, run `npm run db:reset -- --fresh-2fa`; the first Admin sign-in then shows the QR code.

There is exactly one Admin account and no way to create another from the website. PIC accounts are created by the Admin under **PIC Accounts**, which shows a temporary password once.

## Reset the sample data

```bash
npm run db:reset
```

This deletes `data/arenahub.db` and `data/uploads/` and starts again from the sample carnival (12 to 14 March 2027). Stop the server first. Every date, team, court and match can be changed by the Admin afterwards.

## Test from a phone on the same Wi-Fi

1. Start the site with `npm run dev` or `npm start`.
2. Find this computer's address: run `ipconfig` and look for the IPv4 address of the Wi-Fi adapter, for example `192.168.1.23`. Next.js also prints it as "Network".
3. On the phone, open `http://192.168.1.23:3000`.
4. If Windows asks whether Node.js may use the network, allow it on **private** networks. If the phone cannot connect, check that the Wi-Fi is set to "Private" in Windows settings.

Live Score checks for new scores every 10 seconds, at once when the page comes back into view, and when the phone regains signal. Nobody needs to refresh.

## Put it online (free, from this computer)

GitHub Pages cannot host ArenaHub: it serves static files only, and ArenaHub needs a running server for the database, sign-in, live scores and photo uploads. Instead, a free Cloudflare quick tunnel gives this computer a public https link:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\share-online.ps1
```

It builds the site, starts it on port 3001, and prints a `https://….trycloudflare.com` link. Anyone with the link can open the site while that window is open. Ctrl+C takes it offline. The link changes every time.

Before sharing the link, sign in as Admin and change the sample passwords above: they are published in this repository. Change the Admin password, and under **PIC Accounts** reset or deactivate every PIC that still has the sample password.

## Backups

The Admin can download everything (database and photos) as one zip from **Backup** (`/staff/admin/backup`). During the carnival, download one at the end of each day and keep it off this computer.

To restore: stop the server, replace `data/arenahub.db` with the `arenahub.db` from the zip, copy the zip's `uploads` folder to `data/uploads`, and start again.

You can also copy the whole `data/` folder while the server is stopped.

## Tests

```bash
npm test                 # unit and data tests (Vitest)
npx playwright install chromium   # first time only
npm run test:e2e         # browser tests (Playwright): public site, PIC and Admin flows, phone/tablet/desktop layouts, accessibility
```

The browser tests build the app and run it on port 3200 with their own database (`data/e2e.db`), so they never touch your data. They need nothing else running on that port.

## Where things are

| Path | What |
|---|---|
| `src/app/(public)/` | Public pages: Home, Live Score, Match, Standings, Schedule, Venues, Photo Share |
| `src/app/staff/` | Sign in, password change, 2FA, and the PIC and Admin portals |
| `src/app/api/` | `/api/live` (the 10-second snapshot) and the photo upload, like and report endpoints |
| `src/domain/` | Pure rules: standings, bracket advancement, match clock, permissions, group tables |
| `src/data/` | Every database read and write (SQLite). Replaced in February for Supabase |
| `src/auth/` | Passwords, sessions, 2FA, rate limits. Replaced in February by Supabase Auth |
| `src/i18n/` | English and Bahasa Melayu text for the public site |
| `data/` | The database and uploaded photos (not in git) |

Design references: `docs/2026-11-02-arenahub-website-design.md` (what and why) and `docs/2026-11-02-supabase-migration.md` (the February move).

## Known limits of Phase 1

- Runs on one computer. If it is off, the website is off.
- Updates reach students within about 10 seconds, not instantly. Instant updates arrive with Supabase Realtime in February.
- Photo uploads are limited per device and per network address, but there is no CAPTCHA yet (Cloudflare Turnstile is planned with hosting).
