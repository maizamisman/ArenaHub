import Link from "next/link";
import { requireRole } from "@/auth/request";
import { listMatchesFor } from "@/data/matches";
import { MatchCard } from "@/components/portal/MatchCards";

export const metadata = { title: "My Matches · ArenaHub" };

const TABS = [["all", "All"], ["live", "In progress"], ["upcoming", "Upcoming"], ["done", "Finished"]] as const;

export default async function MyMatches({ searchParams }: PageProps<"/staff/pic/matches">) {
  const me = await requireRole("pic");
  const tab = String((await searchParams).tab ?? "all");
  const mine = listMatchesFor(me).filter((m) =>
    tab === "live" ? ["live", "paused", "half_time"].includes(m.status) : tab === "upcoming" ? m.status === "upcoming" : tab === "done" ? m.status === "full_time" : true);
  return (
    <>
      <div className="ph"><div><h1>My Matches</h1><p>Matches assigned to you by the Admin, directly or through your court.</p></div></div>
      <div className="chips" role="group" aria-label="Filter">
        {TABS.map(([k, l]) => <Link key={k} className={`chip${tab === k ? " on" : ""}`} aria-current={tab === k ? "true" : undefined} href={`/staff/pic/matches?tab=${k}`}>{l}</Link>)}
      </div>
      <div className="g3">{mine.map((m) => <MatchCard key={m.id} m={m} href={`/staff/pic/score/${m.id}`} cta={m.status === "full_time" ? "View record" : "Open score control"} />)}</div>
      {mine.length === 0 && <div className="card none">No matches here.</div>}
    </>
  );
}
