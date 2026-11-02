import Link from "next/link";
import { requireRole } from "@/auth/request";
import { listPublicMatches } from "@/data/matches";
import { listBracketSlots } from "@/data/public";
import { getDb, plain } from "@/data/db";
import { BracketEditor } from "@/components/portal/BracketEditor";
import { groupTable } from "@/domain/group";
import type { Match } from "@/domain/types";

export const metadata = { title: "Match Mapping · ArenaHub" };

export default async function AdminMap({ searchParams }: PageProps<"/staff/admin/map">) {
  await requireRole("admin");
  const sports = plain<{ id: string; name: string; format: string }>(getDb().prepare("SELECT id, name, format FROM sports WHERE format != 'medal_only' ORDER BY sort, name").all());
  const sport = String((await searchParams).sport ?? sports[0]?.id ?? "");
  const matches = listPublicMatches().filter((m) => m.sport.id === sport);
  const groups = [...new Set(matches.filter((m) => m.group_name).map((m) => m.group_name!))];
  const raw = plain<Match>(getDb().prepare("SELECT * FROM matches WHERE sport_id = ?").all(sport));
  const teamName = (id: string) => matches.flatMap((m) => [m.team_a, m.team_b]).find((t) => t?.id === id)?.short_name ?? id;
  return (
    <>
      <div className="ph"><div><h1>Match Mapping</h1><p>Build each sport&apos;s bracket and place matches in it. When a match ends, its winner moves into the next slot automatically.</p></div></div>
      <div className="chips" role="group" aria-label="Sport">
        {sports.map((s) => <Link key={s.id} className={`chip${sport === s.id ? " on" : ""}`} href={`/staff/admin/map?sport=${s.id}`} aria-current={sport === s.id ? "true" : undefined}>{s.name}</Link>)}
      </div>
      {groups.map((g) => (
        <section className="twrap" key={g}>
          <div style={{ padding: "14px 14px 6px" }}><h2 style={{ fontSize: 16.5 }}>Group {g}</h2><p style={{ fontSize: 13.5, color: "var(--mute)" }}>To send group winners on, edit the knockout match in Matches and choose its teams.</p></div>
          <table><thead><tr><th>Team</th><th>P</th><th>W</th><th>D</th><th>L</th><th>Pts</th></tr></thead>
            <tbody>{groupTable(raw, g).map((r) => <tr key={r.team}><td className="w" data-l="Team">{teamName(r.team)}</td><td data-l="P">{r.p}</td><td data-l="W">{r.w}</td><td data-l="D">{r.d}</td><td data-l="L">{r.l}</td><td data-l="Pts"><b>{r.pts}</b></td></tr>)}</tbody></table>
        </section>
      ))}
      <BracketEditor sportId={sport} slots={listBracketSlots().filter((s) => s.sport_id === sport)} matches={matches} />
    </>
  );
}
