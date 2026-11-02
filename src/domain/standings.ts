import type { Match, MedalKind, MedalResult, MedalRule, Team } from "./types.ts";

export type StandingRow = {
  team: string;
  teamId: string;
  institution: string;
  gold: number;
  silver: number;
  bronze: number;
  total: number;
  rank: number;
  medals: { kind: MedalKind; sport: string; event: string }[];
};

const ORDER: MedalKind[] = ["gold", "silver", "bronze"];

/** Medal table: awarded only from finished matches and medal-only results, never by hand. */
export function computeStandings(input: {
  teams: Team[];
  matches: Match[];
  rules: MedalRule[];
  medalResults: MedalResult[];
  sports?: { id: string; name: string }[];
}): StandingRow[] {
  const sportName = (id: string) => input.sports?.find((s) => s.id === id)?.name ?? id;
  const rows = new Map<string, StandingRow>();
  for (const t of input.teams) {
    rows.set(t.id, { team: t.short_name, teamId: t.id, institution: t.institution, gold: 0, silver: 0, bronze: 0, total: 0, rank: 0, medals: [] });
  }
  const award = (teamId: string | null, kind: MedalKind, sport: string, event: string) => {
    const r = teamId ? rows.get(teamId) : undefined;
    if (!r) return;
    r[kind]++;
    r.total++;
    r.medals.push({ kind, sport, event });
  };

  for (const m of input.matches) {
    if (m.status !== "full_time" || !m.winner) continue;
    const loser = m.winner === m.team_a ? m.team_b : m.team_a;
    for (const rule of input.rules) {
      if (rule.sport_id !== m.sport_id || rule.round !== m.round) continue;
      award(rule.outcome === "winner" ? m.winner : loser, rule.medal, sportName(m.sport_id), m.round);
    }
  }
  for (const r of input.medalResults) {
    for (const kind of ORDER) award(r[kind], kind, sportName(r.sport_id), r.event_name);
  }

  const list = [...rows.values()].sort(
    (x, y) => y.gold - x.gold || y.silver - x.silver || y.bronze - x.bronze || x.team.localeCompare(y.team),
  );
  list.forEach((r, i) => {
    const p = list[i - 1];
    r.rank = p && p.gold === r.gold && p.silver === r.silver && p.bronze === r.bronze ? p.rank : i + 1;
    r.medals.sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind));
  });
  return list;
}
