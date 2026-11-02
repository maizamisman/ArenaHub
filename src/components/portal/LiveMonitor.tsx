"use client";

import Link from "next/link";
import type { LiveSnapshot } from "@/data/matches";
import { useLive } from "@/lib/useLive";
import { LiveBadge } from "@/components/LiveBadge";
import { fmtTime } from "@/i18n";
import { StatusPill } from "./PortalShell";

export function LiveMonitor({ snapshot, picFor }: { snapshot: LiveSnapshot; picFor: Record<string, string> }) {
  const { snapshot: s, stale, lastUpdated } = useLive(snapshot);
  const active = s.matches.filter((m) => ["live", "paused", "half_time"].includes(m.status));
  const next = s.matches.filter((m) => m.status === "upcoming").sort((a, b) => a.starts_at.localeCompare(b.starts_at)).slice(0, 4);
  const lastEvent = (id: string) => s.events.find((e) => e.match_id === id);
  return (
    <>
      <div><LiveBadge lastUpdated={lastUpdated} stale={stale} className="lbadge" /></div>
      <div className="g3">
        {active.map((m) => (
          <article className="card" key={m.id}>
            <div className="mh"><span>{m.sport.name}, {m.round}, {m.court.name}</span><StatusPill status={m.status} /></div>
            <div className="mini"><b>{m.team_a?.short_name}</b><span className="num">{m.score_a} - {m.score_b}</span><b className="e">{m.team_b?.short_name}</b></div>
            <div className="mf" style={{ marginBottom: 10 }}><span>PIC: {picFor[m.id] || <b style={{ color: "var(--err)" }}>nobody assigned</b>}</span>
              {lastEvent(m.id) && <span>Last event {fmtTime(lastEvent(m.id)!.created_at)}</span>}</div>
            <Link className="btn s" style={{ width: "100%" }} href={`/staff/admin/score/${m.id}`}>Take over score control</Link>
          </article>
        ))}
      </div>
      {active.length === 0 && <div className="card none">No matches are in progress.</div>}
      <section className="card"><h2>Starting next</h2>
        <div className="feed">{next.map((m) => <div key={m.id}>{fmtTime(m.starts_at)}: {m.team_a?.short_name ?? "TBD"} vs {m.team_b?.short_name ?? "TBD"}, {m.sport.name}<small>{m.court.name}. PIC: {picFor[m.id] || "nobody assigned"}</small></div>)}
          {next.length === 0 && <div>Nothing scheduled.</div>}</div>
      </section>
    </>
  );
}
