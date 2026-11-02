import { describe, it, expect } from "vitest";
import { groupTable } from "@/domain/group";
import { match } from "./fixtures";

describe("group", () => {
  it("group table orders by points then goal difference", () => {
    const g = { group_name: "A", round: "Group stage" };
    const ms = [
      match({ ...g, team_a: "A", team_b: "B", score_a: 1, score_b: 0 }),
      match({ ...g, team_a: "C", team_b: "D", score_a: 5, score_b: 0 }),
      match({ ...g, team_a: "A", team_b: "C", score_a: 2, score_b: 2 }),
      match({ ...g, team_a: "B", team_b: "D", score_a: 1, score_b: 1 }),
      match({ ...g, team_a: "B", team_b: "C", score_a: 9, score_b: 0, status: "live" }),
      match({ team_a: "A", team_b: "D", score_a: 9, score_b: 0, group_name: "B" }),
    ];
    const t = groupTable(ms, "A");
    // C and A both have 4 points; C's goal difference (+5) beats A's (+1).
    expect(t.map((r) => r.team)).toEqual(["C", "A", "B", "D"]);
    expect(t[0]).toEqual({ team: "C", p: 2, w: 1, d: 1, l: 0, pts: 4 });
    expect(t[1]).toEqual({ team: "A", p: 2, w: 1, d: 1, l: 0, pts: 4 });
  });
});
