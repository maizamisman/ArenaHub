import Link from "next/link";
import { requireRole } from "@/auth/request";
import { getDb } from "@/data/db";
import { listPublicMatches } from "@/data/matches";
import { listAudit } from "@/data/audit";
import { listPics } from "@/data/people";
import { listForModeration } from "@/data/photos";
import { MatchTable } from "@/components/portal/MatchCards";
import { fmtDay, fmtTime } from "@/i18n";
import { describeAudit } from "@/components/portal/auditText";

export const metadata = { title: "Admin Dashboard · ArenaHub" };

export default async function AdminDashboard() {
  await requireRole("admin");
  const all = listPublicMatches();
  const live = all.filter((m) => ["live", "paused", "half_time"].includes(m.status));
  const next = all.filter((m) => m.status === "upcoming").sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const pics = listPics();
  const pending = listForModeration().filter((p) => p.status === "pending").length;
  const activity = listAudit(getDb(), { limit: 8 });
  const stats = [
    [live.length, "Matches in progress", "/staff/admin/monitor"], [next.length, "Upcoming matches", "/staff/admin/matches"],
    [pics.filter((p) => p.active).length, "Active PICs", "/staff/admin/pics"], [pending, "Photos waiting for review", "/staff/admin/photos"],
  ] as const;
  return (
    <>
      <div className="ph"><div><h1>Dashboard</h1><p>Everything happening at the carnival right now.</p></div>
        <div className="tools"><Link className="btn s" href="/" target="_blank">Open public website</Link><Link className="btn p" href="/staff/admin/matches">Manage matches</Link></div>
      </div>
      <div className="g4">{stats.map(([n, l, href]) => <Link className="card stat" key={l} href={href} style={{ textDecoration: "none" }}><b>{n}</b><span>{l}</span></Link>)}</div>
      <div className="g2">
        <MatchTable title="In progress and next up" rows={[...live, ...next.slice(0, 6)]} hrefFor={(m) => `/staff/admin/score/${m.id}`} />
        <section className="card"><h2>Recent activity</h2>
          <div className="feed">{activity.map((a) => <div key={a.id}>{a.who}: {describeAudit(a)}<small>{fmtDay(a.at, "en")}, {fmtTime(a.at)}</small></div>)}
            {activity.length === 0 && <div>No activity yet.</div>}</div>
          <Link className="btn s sm" style={{ marginTop: 10 }} href="/staff/admin/audit">Open the Audit Log</Link>
        </section>
      </div>
    </>
  );
}
