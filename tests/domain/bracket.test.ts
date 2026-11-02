import { describe, it, expect } from "vitest";
import { advanceWinner } from "@/domain/bracket";
import { match } from "./fixtures";

describe("bracket", () => {
  it("winner of semi-final 1 goes to final side a, semi-final 2 to side b", () => {
    const sf1 = match({ id: "sf1", round: "Semi-final 1", team_a: "A", team_b: "B", winner: "A" });
    const sf2 = match({ id: "sf2", round: "Semi-final 2", team_a: "C", team_b: "D", winner: "D" });
    const fin = match({ id: "fin", status: "upcoming", team_a: null, team_b: null });
    const slots = [
      { id: "s1", sport_id: "football", round_index: 0, slot_index: 0, match_id: "sf1", feeds_slot_id: "s3", feeds_side: "a" as const },
      { id: "s2", sport_id: "football", round_index: 0, slot_index: 1, match_id: "sf2", feeds_slot_id: "s3", feeds_side: "b" as const },
      { id: "s3", sport_id: "football", round_index: 1, slot_index: 0, match_id: "fin", feeds_slot_id: null, feeds_side: null },
    ];
    expect(advanceWinner(slots, [sf1, sf2, fin], "sf1")).toEqual({ matchId: "fin", side: "a", team: "A" });
    expect(advanceWinner(slots, [sf1, sf2, fin], "sf2")).toEqual({ matchId: "fin", side: "b", team: "D" });
    expect(advanceWinner(slots, [sf1, sf2, fin], "fin")).toBeNull();
  });
});
