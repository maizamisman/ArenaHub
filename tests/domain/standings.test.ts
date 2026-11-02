import { describe, it, expect } from "vitest";
import { computeStandings } from "@/domain/standings";
import { teams, match, rules } from "./fixtures";

const row = (rows: ReturnType<typeof computeStandings>, team: string) => rows.find((r) => r.team === team)!;

describe("standings", () => {
  it("final winner gets gold and loser silver", () => {
    const rows = computeStandings({ teams, matches: [match({ winner: "A", score_a: 2, score_b: 1 })], rules, medalResults: [] });
    expect(row(rows, "A Laut")).toMatchObject({ gold: 1, silver: 0, bronze: 0, total: 1, rank: 1 });
    expect(row(rows, "B Laut")).toMatchObject({ gold: 0, silver: 1, total: 1, rank: 2 });
    expect(row(rows, "A Laut").medals).toEqual([{ kind: "gold", sport: "football", event: "Final" }]);
  });

  it("third place winner gets bronze", () => {
    const rows = computeStandings({ teams, matches: [match({ round: "Third place", team_a: "C", team_b: "D", winner: "D" })], rules, medalResults: [] });
    expect(row(rows, "D Laut")).toMatchObject({ bronze: 1, total: 1 });
    expect(row(rows, "C Laut").total).toBe(0);
  });

  it("medal_only results count", () => {
    const rows = computeStandings({
      teams, matches: [], rules,
      medalResults: [{ id: "r1", sport_id: "badminton", event_name: "Men's Singles", gold: "C", silver: "A", bronze: "B" }],
      sports: [{ id: "badminton", name: "Badminton" }],
    });
    expect(row(rows, "C Laut")).toMatchObject({ gold: 1, rank: 1 });
    expect(row(rows, "C Laut").medals).toEqual([{ kind: "gold", sport: "Badminton", event: "Men's Singles" }]);
    expect(row(rows, "B Laut").bronze).toBe(1);
  });

  it("ranks by gold then silver then bronze and ties share rank", () => {
    const medalResults = [
      { id: "1", sport_id: "x", event_name: "E1", gold: "B", silver: "A", bronze: "C" },
      { id: "2", sport_id: "x", event_name: "E2", gold: "A", silver: "B", bronze: null },
      { id: "3", sport_id: "x", event_name: "E3", gold: "D", silver: null, bronze: null },
    ];
    const rows = computeStandings({ teams, matches: [], rules, medalResults });
    expect(rows.map((r) => [r.team, r.rank])).toEqual([["A Laut", 1], ["B Laut", 1], ["D Laut", 3], ["C Laut", 4]]);
  });

  it("unfinished finals award nothing", () => {
    const rows = computeStandings({ teams, matches: [match({ status: "live", score_a: 3 })], rules, medalResults: [] });
    expect(rows.every((r) => r.total === 0)).toBe(true);
    expect(rows.every((r) => r.rank === 1)).toBe(true);
  });
});
