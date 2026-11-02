import type { Assignment, Match, SessionUser } from "./types.ts";

/** Admin controls every match; a PIC only matches assigned to them directly or by court. */
export function canControlMatch(user: SessionUser, match: Pick<Match, "id" | "court_id">, assignments: Assignment[]): boolean {
  if (!user.active) return false;
  if (user.role === "admin") return true;
  return assignments.some(
    (a) => a.user_id === user.id && (a.match_id === match.id || (a.court_id !== null && a.court_id === match.court_id)),
  );
}
