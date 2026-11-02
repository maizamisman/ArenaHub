import type { BracketSlot, Match, Side } from "./types.ts";

/** Where the winner of a finished match goes next, or null if it feeds nothing. */
export function advanceWinner(
  slots: BracketSlot[],
  matches: Match[],
  finishedMatchId: string,
): { matchId: string; side: Side; team: string } | null {
  const m = matches.find((x) => x.id === finishedMatchId);
  if (!m?.winner) return null;
  const slot = slots.find((s) => s.match_id === finishedMatchId);
  if (!slot?.feeds_slot_id || !slot.feeds_side) return null;
  const next = slots.find((s) => s.id === slot.feeds_slot_id);
  if (!next?.match_id) return null;
  return { matchId: next.match_id, side: slot.feeds_side, team: m.winner };
}
