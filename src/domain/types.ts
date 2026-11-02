// Row shapes shared by the domain rules and the data layer. Mirrors schema.sql.

export type MatchStatus = "upcoming" | "live" | "paused" | "half_time" | "full_time";
export type Side = "a" | "b";
export type MedalKind = "gold" | "silver" | "bronze";
export type Role = "admin" | "pic";

export type Team = { id: string; short_name: string; institution: string; active: number; manager?: string };

export type Match = {
  id: string;
  sport_id: string;
  round: string;
  group_name: string | null;
  team_a: string | null;
  team_b: string | null;
  court_id: string;
  starts_at: string;
  status: MatchStatus;
  score_a: number;
  score_b: number;
  winner: string | null;
  clock_started_at: string | null;
  clock_elapsed_ms: number;
  version: number;
  updated_at: string;
};

export type MedalRule = { sport_id: string; round: string; medal: MedalKind; outcome: "winner" | "loser" };

export type MedalResult = { id: string; sport_id: string; event_name: string; gold: string | null; silver: string | null; bronze: string | null };

export type BracketSlot = {
  id: string;
  sport_id: string;
  round_index: number;
  slot_index: number;
  match_id: string | null;
  feeds_slot_id: string | null;
  feeds_side: Side | null;
};

export type Assignment = { user_id: string; match_id: string | null; court_id: string | null };

export type SessionUser = { id: string; name: string; email: string; role: Role; active: boolean; mustChange?: boolean; mfaOk?: boolean };
