import Link from "next/link";
import { canUserControl, getLiveSnapshot, getPublicMatch, listMatchesFor, matchLog } from "@/data/matches";
import type { SessionUser } from "@/domain/types";
import { ScoreControl } from "./ScoreControl";
import { vsLabel } from "./MatchCards";

/** Shared by the PIC and Admin score screens; refuses matches the user is not assigned to. */
export function ScorePage({ me, id, back }: { me: SessionUser; id: string; back: string }) {
  const m = getPublicMatch(id);
  if (!m || !canUserControl(me, id)) {
    return (
      <section className="card" style={{ maxWidth: 560 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>{m ? "You are not assigned to this match" : "Match not found"}</h1>
        <p style={{ marginTop: 8, color: "var(--mute)", lineHeight: 1.5 }}>{m ? "Only the PIC assigned to this match or its court, and the Admin, can change it. Ask the Admin if this is wrong." : "It may have been deleted."}</p>
        <Link className="btn s" style={{ marginTop: 14 }} href={back}>Back to my matches</Link>
      </section>
    );
  }
  const options = listMatchesFor(me).filter((x) => x.status !== "full_time" || x.id === id).map((x) => ({ id: x.id, label: `${vsLabel(x)} (${x.sport.name})` }));
  return <ScoreControl key={id} initial={m} initialLog={matchLog(id)} snapshot={getLiveSnapshot()} options={options} isAdmin={me.role === "admin"} />;
}
