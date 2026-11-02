import Link from "next/link";
import { requireRole } from "@/auth/request";
import { listMatchesFor } from "@/data/matches";
import { MatchTable, scoreText, when } from "@/components/portal/MatchCards";
import { StatusPill } from "@/components/portal/PortalShell";

export const metadata = { title: "PIC Dashboard · ArenaHub" };

export default async function PicDashboard() {
  const me = await requireRole("pic");
  const mine = listMatchesFor(me);
  const live = mine.filter((m) => m.status === "live" || m.status === "paused" || m.status === "half_time");
  const upcoming = mine.filter((m) => m.status === "upcoming").sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const done = mine.filter((m) => m.status === "full_time");
  const focus = live[0] ?? upcoming[0];
  const stats = [[mine.length, "Assigned to you"], [live.length, "In progress"], [upcoming.length, "Upcoming"], [done.length, "Finished"]] as const;

  return (
    <>
      <div className="ph"><div><h1>Hello, {me.name.split(" ")[0]}</h1><p>You can manage only the matches assigned to you.</p></div></div>
      <div className="g4">{stats.map(([n, l]) => <div className="card stat" key={l}><b>{n}</b><span>{l}</span></div>)}</div>
      {focus && (
        <section className="card">
          <div className="mh"><span>{focus.sport.name}, {focus.round}, {focus.court.name}</span><StatusPill status={focus.status} /></div>
          <div className="mini"><b>{focus.team_a?.short_name ?? "TBD"}</b><span className="num">{scoreText(focus)}</span><b className="e">{focus.team_b?.short_name ?? "TBD"}</b></div>
          <div className="mf" style={{ marginBottom: 10 }}><span>{when(focus)}</span></div>
          <Link className="btn p" style={{ width: "100%", minHeight: 54, fontSize: 16 }} href={`/staff/pic/score/${focus.id}`}>{live[0] ? "Open score control" : "Prepare this match"}</Link>
        </section>
      )}
      <MatchTable title="Your assigned matches" rows={[...live, ...upcoming, ...done]} hrefFor={(m) => `/staff/pic/score/${m.id}`} />
    </>
  );
}
