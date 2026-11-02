import type { Match } from "./types.ts";

export type GroupRow = { team: string; p: number; w: number; d: number; l: number; pts: number };

/** Group table from finished matches: 3 points a win, 1 a draw; ties broken by goal difference, then goals for. */
export function groupTable(matches: Match[], groupName: string): GroupRow[] {
  const rows = new Map<string, GroupRow & { gf: number; ga: number }>();
  const get = (team: string) => {
    let r = rows.get(team);
    if (!r) rows.set(team, (r = { team, p: 0, w: 0, d: 0, l: 0, pts: 0, gf: 0, ga: 0 }));
    return r;
  };
  for (const m of matches) {
    if (m.group_name !== groupName || !m.team_a || !m.team_b) continue;
    const a = get(m.team_a), b = get(m.team_b);
    if (m.status !== "full_time") continue;
    a.p++; b.p++;
    a.gf += m.score_a; a.ga += m.score_b;
    b.gf += m.score_b; b.ga += m.score_a;
    if (m.score_a === m.score_b) { a.d++; b.d++; a.pts++; b.pts++; }
    else {
      const [w, l] = m.score_a > m.score_b ? [a, b] : [b, a];
      w.w++; w.pts += 3; l.l++;
    }
  }
  return [...rows.values()]
    .sort((x, y) => y.pts - x.pts || (y.gf - y.ga) - (x.gf - x.ga) || y.gf - x.gf || x.team.localeCompare(y.team))
    .map(({ team, p, w, d, l, pts }) => ({ team, p, w, d, l, pts }));
}
