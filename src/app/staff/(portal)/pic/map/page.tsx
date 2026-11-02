import Link from "next/link";
import { requireRole } from "@/auth/request";
import { listMatchesFor, listPublicMatches } from "@/data/matches";
import { listBracketSlots, listSports } from "@/data/public";
import { BracketView } from "@/components/portal/BracketView";

export const metadata = { title: "Match Mapping · ArenaHub" };

export default async function PicMap({ searchParams }: PageProps<"/staff/pic/map">) {
  const me = await requireRole("pic");
  const mineIds = new Set(listMatchesFor(me).map((m) => m.id));
  const slots = listBracketSlots();
  const sports = listSports().filter((s) => slots.some((x) => x.sport_id === s.id));
  const sport = String((await searchParams).sport ?? sports[0]?.id ?? "");
  return (
    <>
      <div className="ph"><div><h1>Match Mapping</h1><p>Where each match leads. Winners move on automatically when a match is ended. Open one of yours to score it.</p></div></div>
      <div className="chips" role="group" aria-label="Sport">
        {sports.map((s) => <Link key={s.id} className={`chip${sport === s.id ? " on" : ""}`} href={`/staff/pic/map?sport=${s.id}`} aria-current={sport === s.id ? "true" : undefined}>{s.name}</Link>)}
      </div>
      <BracketView slots={slots.filter((s) => s.sport_id === sport)} matches={listPublicMatches()} hrefFor={(m) => (mineIds.has(m.id) ? `/staff/pic/score/${m.id}` : null)} />
    </>
  );
}
