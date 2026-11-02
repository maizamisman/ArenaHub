-- ArenaHub Phase 1 schema. Ids are TEXT uuids; times are ISO strings in UTC.

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','pic')),
  password_hash TEXT NOT NULL,
  must_change_password INTEGER NOT NULL DEFAULT 0,
  totp_secret TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);
-- Exactly one Admin: a second admin row cannot be inserted.
CREATE UNIQUE INDEX IF NOT EXISTS one_admin ON users(role) WHERE role = 'admin';

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  mfa_ok INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL -- JSON
);

CREATE TABLE IF NOT EXISTS sports (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_bm TEXT NOT NULL,
  format TEXT NOT NULL CHECK (format IN ('knockout','group_knockout','medal_only')),
  scoring TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  sort INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS medal_rules (
  sport_id TEXT NOT NULL REFERENCES sports(id) ON DELETE CASCADE,
  round TEXT NOT NULL,
  medal TEXT NOT NULL CHECK (medal IN ('gold','silver','bronze')),
  outcome TEXT NOT NULL CHECK (outcome IN ('winner','loser')),
  PRIMARY KEY (sport_id, round, medal)
);

CREATE TABLE IF NOT EXISTS teams (
  id TEXT PRIMARY KEY,
  short_name TEXT NOT NULL UNIQUE,
  institution TEXT NOT NULL,
  manager TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS courts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_bm TEXT NOT NULL,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  notes TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS matches (
  id TEXT PRIMARY KEY,
  sport_id TEXT NOT NULL REFERENCES sports(id),
  round TEXT NOT NULL,
  group_name TEXT,
  team_a TEXT REFERENCES teams(id),
  team_b TEXT REFERENCES teams(id),
  court_id TEXT NOT NULL REFERENCES courts(id),
  starts_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming','live','paused','half_time','full_time')),
  score_a INTEGER NOT NULL DEFAULT 0 CHECK (score_a >= 0),
  score_b INTEGER NOT NULL DEFAULT 0 CHECK (score_b >= 0),
  winner TEXT REFERENCES teams(id),
  clock_started_at TEXT,
  clock_elapsed_ms INTEGER NOT NULL DEFAULT 0,
  version INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL,
  CHECK (team_a IS NULL OR team_b IS NULL OR team_a <> team_b)
);

CREATE TABLE IF NOT EXISTS match_events (
  id TEXT PRIMARY KEY,
  match_id TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('goal','point','card_yellow','card_red','set','substitution','note')),
  team TEXT REFERENCES teams(id),
  detail TEXT NOT NULL DEFAULT '',
  minute_label TEXT NOT NULL DEFAULT '',
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS bracket_slots (
  id TEXT PRIMARY KEY,
  sport_id TEXT NOT NULL REFERENCES sports(id) ON DELETE CASCADE,
  round_index INTEGER NOT NULL,
  slot_index INTEGER NOT NULL,
  match_id TEXT REFERENCES matches(id) ON DELETE SET NULL,
  feeds_slot_id TEXT REFERENCES bracket_slots(id),
  feeds_side TEXT CHECK (feeds_side IN ('a','b'))
);

CREATE TABLE IF NOT EXISTS medal_results (
  id TEXT PRIMARY KEY,
  sport_id TEXT NOT NULL REFERENCES sports(id),
  event_name TEXT NOT NULL,
  gold TEXT REFERENCES teams(id),
  silver TEXT REFERENCES teams(id),
  bronze TEXT REFERENCES teams(id)
);

CREATE TABLE IF NOT EXISTS assignments (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  match_id TEXT REFERENCES matches(id) ON DELETE CASCADE,
  court_id TEXT REFERENCES courts(id) ON DELETE CASCADE,
  CHECK (match_id IS NOT NULL OR court_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS photos (
  id TEXT PRIMARY KEY,
  file TEXT NOT NULL,
  caption TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'live' CHECK (status IN ('pending','live','removed')),
  by_admin INTEGER NOT NULL DEFAULT 0,
  device_hash TEXT NOT NULL DEFAULT '',
  reports INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS photo_likes (
  photo_id TEXT NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
  device_hash TEXT NOT NULL,
  PRIMARY KEY (photo_id, device_hash)
);

CREATE TABLE IF NOT EXISTS announcements (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  lang TEXT NOT NULL CHECK (lang IN ('en','bm')),
  published INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  at TEXT NOT NULL,
  user_id TEXT REFERENCES users(id),
  action TEXT NOT NULL,
  match_id TEXT,
  before TEXT, -- JSON
  after TEXT,  -- JSON
  reason TEXT
);
CREATE INDEX IF NOT EXISTS audit_by_match ON audit_log(match_id, at);

CREATE TABLE IF NOT EXISTS request_ids (
  id TEXT PRIMARY KEY,
  at TEXT NOT NULL
);

-- Rate limiting: failed logins per email, uploads per device and per IP.
CREATE TABLE IF NOT EXISTS rate_events (
  bucket TEXT NOT NULL,
  at_ms INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS rate_by_bucket ON rate_events(bucket, at_ms);
