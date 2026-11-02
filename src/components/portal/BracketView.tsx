import Link from "next/link";
import type { PublicMatch } from "@/data/matches";
import type { BracketSlot } from "@/domain/types";
import { roundGroupName } from "@/i18n";

/** Read-only bracket for one sport. Matches the viewer can control link to their score screen. */
export function BracketView({ slots, matches, hrefFor }: { slots: BracketSlot[]; matches: PublicMatch[]; hrefFor: (m: PublicMatch) => string | null }) {
  const byId = new Map(matches.map((m) => [m.id, m]));
  const rounds = [...new Set(slots.map((s) => s.round_index))].sort((a, b) => a - b)
    .map((ri) => slots.filter((s) => s.round_index === ri).sort((a, b) => a.slot_index - b.slot_index));
  return (
    <section className="card"><div className="brk">
      {rounds.map((r, ri) => {
        const first = r.map((s) => byId.get(s.match_id ?? "")).find(Boolean);
        return (
          <div className="col" key={ri}><h3>{first ? roundGroupName(first.round, "en") : `Round ${ri + 1}`}</h3><div className="ms">
            {r.map((s) => {
              const m = s.match_id ? byId.get(s.match_id) : undefined;
              if (!m) return <div className="bm lock" key={s.id}><span className="l"><span>To be decided</span></span><span className="l"><span>To be decided</span></span></div>;
              const done = m.status === "full_time";
              const href = hrefFor(m);
              const body = <>
                <span className={`l${done && m.winner === m.team_a?.id ? " w" : ""}`}><span>{m.team_a?.short_name ?? "To be decided"}</span><b>{m.status === "upcoming" ? "" : m.score_a}</b></span>
                <span className={`l${done && m.winner === m.team_b?.id ? " w" : ""}`}><span>{m.team_b?.short_name ?? "To be decided"}</span><b>{m.status === "upcoming" ? "" : m.score_b}</b></span>
                <span className="n">{m.round}, {m.status === "full_time" ? "finished" : m.status === "upcoming" ? "upcoming" : "in progress"}{href ? "" : " (not yours)"}</span>
              </>;
              return href ? <Link key={s.id} className="bm" href={href}>{body}</Link> : <div key={s.id} className="bm lock">{body}</div>;
            })}
          </div></div>
        );
      })}
    </div></section>
  );
}
