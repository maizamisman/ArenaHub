import type { Match, Team } from "@/domain/types";

export const teams: Team[] = ["A", "B", "C", "D"].map((x) => ({ id: x, short_name: `${x} Laut`, institution: `Uni ${x}`, active: 1 }));

let n = 0;
export function match(p: Partial<Match>): Match {
  n++;
  return {
    id: `m${n}`, sport_id: "football", round: "Final", group_name: null, team_a: "A", team_b: "B", court_id: "field",
    starts_at: "2027-03-14T07:00:00.000Z", status: "full_time", score_a: 0, score_b: 0, winner: null,
    clock_started_at: null, clock_elapsed_ms: 0, version: 1, updated_at: "2027-03-14T07:00:00.000Z", ...p,
  };
}

export const rules = [
  { sport_id: "football", round: "Final", medal: "gold" as const, outcome: "winner" as const },
  { sport_id: "football", round: "Final", medal: "silver" as const, outcome: "loser" as const },
  { sport_id: "football", round: "Third place", medal: "bronze" as const, outcome: "winner" as const },
];
