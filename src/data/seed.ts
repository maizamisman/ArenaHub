import type { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { UPLOAD_DIR, uuid, nowIso } from "./db.ts";
import { hashPassword } from "../auth/password.ts";
import { base32Encode } from "../auth/base32.ts";

export type SeedOptions = {
  adminPassword: string;
  picPassword: string;
  /** Fixed TOTP secret for the Admin; null leaves 2FA to be set up on first login. */
  adminTotpSecret?: string | null;
  /** Copy the mock photos into data/uploads (off in unit tests). */
  copyPhotos?: boolean;
};

export const DEFAULT_LOGINS = {
  adminEmail: "admin@arenahub.my",
  adminPassword: "ArenaHub-Admin-2027",
  picPassword: "ArenaHub-Pic-2027",
};

const MOCK_IMAGE_DIR = path.resolve(process.cwd(), "..", "mock image");

/** Malaysia time (UTC+8) for the carnival, stored as UTC ISO. */
const at = (day: number, hhmm: string) => new Date(`2027-03-${day}T${hhmm}:00+08:00`).toISOString();

const SPORTS = [
  ["football", "Football", "Bola Sepak", "Goals"],
  ["futsal", "Futsal", "Futsal", "Goals"],
  ["netball", "Netball", "Bola Jaring", "Points"],
  ["volleyball", "Volleyball", "Bola Tampar", "Sets"],
  ["takraw", "Sepak Takraw", "Sepak Takraw", "Sets"],
  ["badminton", "Badminton", "Badminton", "Sets"],
  ["tugofwar", "Tug of War", "Tarik Tali", "Pulls"],
] as const;

const TEAMS = [
  ["UM Laut", "Universiti Malaya"],
  ["UKM Laut", "Universiti Kebangsaan Malaysia"],
  ["UPM Laut", "Universiti Putra Malaysia"],
  ["UiTM Laut", "Universiti Teknologi MARA"],
  ["UTM Laut", "Universiti Teknologi Malaysia"],
  ["USM Laut", "Universiti Sains Malaysia"],
  ["UMT Laut", "Universiti Malaysia Terengganu"],
  ["UMP Laut", "Universiti Malaysia Pahang"],
] as const;

// Placeholder coordinates around KD Sri Klang, Port Klang. Admin-editable.
const COURTS = [
  ["field", "Main Field", "Padang Utama", 3.00062, 101.39214, "Grandstand on the west side."],
  ["hall", "Multipurpose Hall", "Dewan Serbaguna", 3.00121, 101.39302, "Entrance faces the car park."],
  ["net", "Netball Court", "Gelanggang Bola Jaring", 2.99988, 101.39271, "Next to the Main Field."],
  ["takraw", "Takraw Court", "Gelanggang Takraw", 3.00034, 101.39355, "Behind the Multipurpose Hall."],
] as const;

type M = {
  key: string; sport: string; round: string; a: string | null; b: string | null; court: string;
  day: number; time: string; status: "upcoming" | "live" | "full_time"; sa?: number; sb?: number;
  elapsedMin?: number; pic?: "aina" | "danial";
};

// The prototype's matches, plus football quarter-finals 3 and 4 that its bracket shows.
const MATCHES: M[] = [
  { key: "m1", sport: "football", round: "Final", a: "UM Laut", b: "UMT Laut", court: "field", day: 14, time: "15:00", status: "live", sa: 2, sb: 1, elapsedMin: 58, pic: "aina" },
  { key: "m2", sport: "futsal", round: "Semi-final 2", a: "UiTM Laut", b: "UTM Laut", court: "hall", day: 14, time: "15:30", status: "live", sa: 4, sb: 4, elapsedMin: 31, pic: "danial" },
  { key: "m3", sport: "netball", round: "Final", a: "UM Laut", b: "UTM Laut", court: "net", day: 14, time: "15:15", status: "live", sa: 28, sb: 31, elapsedMin: 36, pic: "aina" },
  { key: "m5", sport: "takraw", round: "Semi-final 1", a: "UM Laut", b: "UiTM Laut", court: "takraw", day: 14, time: "15:20", status: "live", sa: 1, sb: 1, elapsedMin: 41 },
  { key: "u1", sport: "volleyball", round: "Semi-final 1", a: "UMT Laut", b: "UMP Laut", court: "hall", day: 14, time: "16:30", status: "upcoming", pic: "danial" },
  { key: "u4", sport: "takraw", round: "Semi-final 2", a: "UKM Laut", b: "UPM Laut", court: "takraw", day: 14, time: "16:30", status: "upcoming" },
  { key: "u2", sport: "netball", round: "Third place", a: "UKM Laut", b: "USM Laut", court: "net", day: 14, time: "17:00", status: "upcoming", pic: "aina" },
  { key: "u3", sport: "football", round: "Third place", a: "UKM Laut", b: "UiTM Laut", court: "field", day: 14, time: "17:15", status: "upcoming", pic: "aina" },
  { key: "u5", sport: "takraw", round: "Final", a: null, b: null, court: "takraw", day: 14, time: "18:00", status: "upcoming" },
  { key: "u6", sport: "badminton", round: "Final", a: "UKM Laut", b: "UTM Laut", court: "hall", day: 14, time: "18:00", status: "upcoming" },
  { key: "u7", sport: "tugofwar", round: "Final", a: "UPM Laut", b: "USM Laut", court: "field", day: 14, time: "19:00", status: "upcoming", pic: "aina" },
  { key: "u8", sport: "volleyball", round: "Final", a: null, b: "UPM Laut", court: "hall", day: 14, time: "20:00", status: "upcoming", pic: "danial" },
  { key: "u9", sport: "futsal", round: "Final", a: "UPM Laut", b: null, court: "hall", day: 14, time: "21:00", status: "upcoming", pic: "danial" },
  { key: "c5", sport: "football", round: "Semi-final 1", a: "UM Laut", b: "UKM Laut", court: "field", day: 13, time: "15:00", status: "full_time", sa: 2, sb: 1, pic: "aina" },
  { key: "c6", sport: "football", round: "Semi-final 2", a: "UMT Laut", b: "UiTM Laut", court: "field", day: 13, time: "17:00", status: "full_time", sa: 1, sb: 0, pic: "danial" },
  { key: "c7", sport: "netball", round: "Semi-final 1", a: "UM Laut", b: "UKM Laut", court: "net", day: 13, time: "11:00", status: "full_time", sa: 40, sb: 35, pic: "aina" },
  { key: "c8", sport: "netball", round: "Semi-final 2", a: "UTM Laut", b: "USM Laut", court: "net", day: 13, time: "14:00", status: "full_time", sa: 38, sb: 30, pic: "danial" },
  { key: "c9", sport: "futsal", round: "Semi-final 1", a: "UPM Laut", b: "UM Laut", court: "hall", day: 13, time: "20:00", status: "full_time", sa: 3, sb: 2, pic: "danial" },
  { key: "c10", sport: "volleyball", round: "Semi-final 2", a: "UPM Laut", b: "UTM Laut", court: "hall", day: 13, time: "10:00", status: "full_time", sa: 3, sb: 1, pic: "danial" },
  { key: "c1", sport: "football", round: "Quarter-final 1", a: "UM Laut", b: "USM Laut", court: "field", day: 12, time: "16:00", status: "full_time", sa: 2, sb: 0, pic: "aina" },
  { key: "c2", sport: "football", round: "Quarter-final 2", a: "UKM Laut", b: "UTM Laut", court: "field", day: 12, time: "17:30", status: "full_time", sa: 3, sb: 2, pic: "aina" },
  { key: "c3", sport: "football", round: "Quarter-final 3", a: "UPM Laut", b: "UMT Laut", court: "field", day: 12, time: "19:00", status: "full_time", sa: 0, sb: 1, pic: "danial" },
  { key: "c4", sport: "football", round: "Quarter-final 4", a: "UiTM Laut", b: "UMP Laut", court: "field", day: 12, time: "20:30", status: "full_time", sa: 2, sb: 1, pic: "danial" },
];

// Brackets: rounds of match keys, earliest first. Slot i of a round feeds slot floor(i/2)
// of the next, side a for even i and side b for odd i.
const BRACKETS: Record<string, string[][]> = {
  football: [["c1", "c2", "c3", "c4"], ["c5", "c6"], ["m1"]],
  futsal: [["c9", "m2"], ["u9"]],
  netball: [["c7", "c8"], ["m3"]],
  volleyball: [["u1", "c10"], ["u8"]],
  takraw: [["m5", "u4"], ["u5"]],
};

const EVENTS: Record<string, [string, string, string | null, string, string][]> = {
  m1: [["1'", "note", null, "Kick-off", "Main Field"], ["27'", "goal", "UM Laut", "Goal", "Amirul Syafiq (#7)"], ["41'", "goal", "UMT Laut", "Goal", "Zaki Hamzah (#11)"], ["52'", "card_yellow", "UMT Laut", "Yellow card", "Haziq Roslan (#4)"], ["58'", "goal", "UM Laut", "Goal", "Faiz Hakimi (#9), assist Aiman Nor"]],
  m2: [["1'", "note", null, "Kick-off", "Multipurpose Hall"], ["HT", "note", null, "Half-time", "UiTM Laut 3-3 UTM Laut"], ["22'", "substitution", "UiTM Laut", "Substitution", "Shah on, Hakim off"], ["29'", "goal", "UiTM Laut", "Goal", "Irfan Daud (#8)"], ["31'", "goal", "UTM Laut", "Goal", "Zulkifli Hamid (#10)"]],
  m3: [["Q1", "note", null, "Centre pass", "Netball Court"], ["Q1", "note", null, "End of first quarter", "UM Laut 8-9 UTM Laut"], ["HT", "note", null, "Half-time", "UM Laut 16-19 UTM Laut"], ["Q3", "point", "UTM Laut", "Goal", "GA Nurul Aina"]],
  m5: [["Set 1", "set", "UM Laut", "Set 1", "21-18"], ["Set 2", "set", "UiTM Laut", "Set 2", "21-17"], ["Set 3", "note", null, "Set 3 in progress", "UM Laut lead 9-7"]],
  c5: [["1'", "note", null, "Kick-off", "Main Field"], ["30'", "goal", "UM Laut", "Goal", "Amirul Syafiq (#7)"], ["41'", "goal", "UKM Laut", "Goal", "Daniel Lee (#11)"], ["77'", "goal", "UM Laut", "Goal", "Faiz Hakimi (#9)"], ["FT", "note", null, "Full time", "UM Laut 2-1 UKM Laut"]],
  c6: [["1'", "note", null, "Kick-off", "Main Field"], ["38'", "goal", "UMT Laut", "Goal", "Zaki Hamzah (#11)"], ["64'", "card_red", "UiTM Laut", "Red card", "Syafiq Ramli (#5)"], ["FT", "note", null, "Full time", "UMT Laut 1-0 UiTM Laut"]],
};

const MEDALS: [string, string, string, string, string][] = [
  ["badminton", "Men's Singles", "UM Laut", "UKM Laut", "UPM Laut"],
  ["badminton", "Women's Singles", "UKM Laut", "UM Laut", "UTM Laut"],
  ["badminton", "Mixed Doubles", "UM Laut", "UiTM Laut", "UKM Laut"],
  ["tugofwar", "Women's", "UPM Laut", "UM Laut", "USM Laut"],
  ["takraw", "Doubles", "UiTM Laut", "UM Laut", "UMT Laut"],
  ["volleyball", "Women's", "UMT Laut", "UPM Laut", "UM Laut"],
  ["futsal", "Women's", "UTM Laut", "UKM Laut", "UiTM Laut"],
];

const PHOTOS: [string, string, string, boolean][] = [
  ["images.jpeg", "Opening ceremony by the Director of PALAPES Laut UM", "2027-03-12T08:15:00+08:00", true],
  ["images (1).jpeg", "Kick-off of the football final", "2027-03-14T15:02:00+08:00", false],
  ["images (2).jpeg", "Fastest heat of the morning", "2027-03-14T09:21:00+08:00", false],
  ["images (3).jpeg", "Warming up before the netball final", "2027-03-14T14:48:00+08:00", false],
  ["images (4).jpeg", "", "2027-03-14T06:40:00+08:00", false],
  ["images (5).jpeg", "Day 2 medal winners", "2027-03-13T22:10:00+08:00", true],
  ["images (6).jpeg", "What a save on the turf", "2027-03-13T10:44:00+08:00", false],
  ["images (7).jpeg", "", "2027-03-13T09:31:00+08:00", false],
];

export const DEFAULT_SETTINGS = {
  event_name: "Karnival Sukan KD Sri Klang 2027",
  tagline: "Every second, every point, live.",
  tagline_bm: "Setiap saat, setiap mata, secara langsung.",
  organiser: "PALAPES Laut Universiti Malaya",
  logo_path: null as string | null,
  theme_colour: "#1F4FE0",
  home_sections: ["live", "standings", "schedule", "photos"],
  modules: { photos: true, announcements: true, standings: true, venue_map: true },
  featured_match_id: null as string | null,
  photo_approval: "instant" as "instant" | "approval",
};

export function seed(db: DatabaseSync, opts: SeedOptions = { adminPassword: DEFAULT_LOGINS.adminPassword, picPassword: DEFAULT_LOGINS.picPassword }): { adminTotpSecret: string | null } {
  const now = nowIso();
  const ins = (sql: string, ...args: (string | number | null)[]) => db.prepare(sql).run(...args);
  const adminTotpSecret = opts.adminTotpSecret === undefined ? base32Encode(randomBytes(20)) : opts.adminTotpSecret;

  db.exec("BEGIN");
  try {
    const adminId = uuid();
    ins("INSERT INTO users VALUES (?,?,?,?,?,?,?,?,?)", adminId, DEFAULT_LOGINS.adminEmail, "Arena Admin", "admin", hashPassword(opts.adminPassword), 0, adminTotpSecret, 1, now);
    const picHash = hashPassword(opts.picPassword);
    const pics: Record<string, string> = {};
    for (const [key, name, email, active] of [["aina", "Aina Sofea", "aina@arenahub.my", 1], ["danial", "Danial Hakim", "danial@arenahub.my", 1], ["meiling", "Mei Ling", "meiling@arenahub.my", 0]] as const) {
      pics[key] = uuid();
      ins("INSERT INTO users VALUES (?,?,?,?,?,?,?,?,?)", pics[key], email, name, "pic", picHash, 1, null, active, now);
    }

    const sportId: Record<string, string> = {};
    SPORTS.forEach(([key, name, bm, scoring], i) => {
      sportId[key] = uuid();
      ins("INSERT INTO sports VALUES (?,?,?,?,?,?,?)", sportId[key], name, bm, "knockout", scoring, 1, i);
      for (const [round, medal, outcome] of [["Final", "gold", "winner"], ["Final", "silver", "loser"], ["Third place", "bronze", "winner"]] as const) {
        ins("INSERT INTO medal_rules VALUES (?,?,?,?)", sportId[key], round, medal, outcome);
      }
    });

    const teamId: Record<string, string> = {};
    TEAMS.forEach(([short, inst], i) => {
      teamId[short] = uuid();
      ins("INSERT INTO teams VALUES (?,?,?,?,?)", teamId[short], short, inst, `Team manager ${i + 1}`, 1);
    });

    const courtId: Record<string, string> = {};
    for (const [key, name, bm, lat, lng, notes] of COURTS) {
      courtId[key] = uuid();
      ins("INSERT INTO courts VALUES (?,?,?,?,?,?)", courtId[key], name, bm, lat, lng, notes);
    }

    const matchId: Record<string, string> = {};
    const t = (n: string | null) => (n ? teamId[n] : null);
    for (const m of MATCHES) {
      matchId[m.key] = uuid();
      const sa = m.sa ?? 0, sb = m.sb ?? 0;
      const winner = m.status === "full_time" ? t(sa > sb ? m.a : m.b) : null;
      const live = m.status === "live";
      ins(
        "INSERT INTO matches (id, sport_id, round, group_name, team_a, team_b, court_id, starts_at, status, score_a, score_b, winner, clock_started_at, clock_elapsed_ms, version, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        matchId[m.key], sportId[m.sport], m.round, null, t(m.a), t(m.b), courtId[m.court], at(m.day, m.time), m.status, sa, sb, winner,
        live ? now : null, (m.elapsedMin ?? 0) * 60_000, 1, now,
      );
      if (m.pic) ins("INSERT INTO assignments VALUES (?,?,?)", pics[m.pic], matchId[m.key], null);
    }
    // Danial also covers the Takraw Court, so every match there is his.
    ins("INSERT INTO assignments VALUES (?,?,?)", pics.danial, null, courtId.takraw);
    // Mei Ling is inactive but keeps an old assignment, to prove inactive users are refused.
    ins("INSERT INTO assignments VALUES (?,?,?)", pics.meiling, null, courtId.net);

    for (const [sport, rounds] of Object.entries(BRACKETS)) {
      const ids = rounds.map((r) => r.map(() => uuid()));
      rounds.forEach((r, ri) => r.forEach((key, si) => {
        ins("INSERT INTO bracket_slots VALUES (?,?,?,?,?,?,?)", ids[ri][si], sportId[sport], ri, si, matchId[key], null, null);
      }));
      rounds.forEach((r, ri) => r.forEach((_, si) => {
        const next = ids[ri + 1]?.[Math.floor(si / 2)];
        if (next) db.prepare("UPDATE bracket_slots SET feeds_slot_id=?, feeds_side=? WHERE id=?").run(next, si % 2 === 0 ? "a" : "b", ids[ri][si]);
      }));
    }

    for (const [key, evs] of Object.entries(EVENTS)) {
      evs.forEach(([minute, kind, team, title, detail], i) => {
        const createdAt = new Date(Date.parse(now) - (evs.length - i) * 60_000).toISOString();
        ins("INSERT INTO match_events VALUES (?,?,?,?,?,?,?,?)", uuid(), matchId[key], kind, t(team), `${title}: ${detail}`, minute, null, createdAt);
      });
    }

    for (const [sport, event, g, s, b] of MEDALS) {
      ins("INSERT INTO medal_results VALUES (?,?,?,?,?,?)", uuid(), sportId[sport], event, teamId[g], teamId[s], teamId[b]);
    }

    for (const [file, caption, when, byAdmin] of PHOTOS) {
      const id = uuid();
      const stored = `${id}.jpg`;
      if (opts.copyPhotos !== false && fs.existsSync(path.join(MOCK_IMAGE_DIR, file))) {
        fs.mkdirSync(UPLOAD_DIR, { recursive: true });
        fs.copyFileSync(path.join(MOCK_IMAGE_DIR, file), path.join(UPLOAD_DIR, stored));
      }
      ins("INSERT INTO photos VALUES (?,?,?,?,?,?,?,?)", id, stored, caption, new Date(when).toISOString(), "live", byAdmin ? 1 : 0, byAdmin ? "admin" : "seed", 0);
    }

    ins("INSERT INTO announcements VALUES (?,?,?,?,?,?)", uuid(), "Extra parking open at Gate 2", "Spectators for the finals at the Main Field can use the extra parking at Gate 2. Please follow the duty officers.", "en", 1, now);
    ins("INSERT INTO announcements VALUES (?,?,?,?,?,?)", uuid(), "Majlis penyampaian pingat malam ini, 22:15", "Semua pasukan sila berkumpul di Dewan Serbaguna selepas perlawanan akhir futsal. Jadual pingat terakhir akan dipaparkan di halaman Kedudukan.", "bm", 1, now);

    const settings = { ...DEFAULT_SETTINGS, featured_match_id: matchId.m1 };
    for (const [k, v] of Object.entries(settings)) ins("INSERT INTO settings VALUES (?,?)", k, JSON.stringify(v));

    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
  return { adminTotpSecret };
}
