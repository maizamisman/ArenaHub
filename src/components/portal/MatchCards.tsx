import Link from "next/link";
import type { PublicMatch } from "@/data/matches";
import { fmtDay, fmtTime } from "@/i18n";
import { StatusPill } from "./PortalShell";

export const vsLabel = (m: PublicMatch) => `${m.team_a?.short_name ?? "To be decided"} vs ${m.team_b?.short_name ?? "To be decided"}`;
export const when = (m: PublicMatch) => `${fmtDay(m.starts_at, "en")}, ${fmtTime(m.starts_at)}`;
export const scoreText = (m: PublicMatch) => (m.status === "upcoming" ? "vs" : `${m.score_a} - ${m.score_b}`);

export function MatchCard({ m, href, cta }: { m: PublicMatch; href: string; cta: string }) {
  return (
    <article className="card">
      <div className="mh"><span>{m.sport.name}, {m.round}</span><StatusPill status={m.status} /></div>
      <h3 style={{ fontSize: 15.5, fontWeight: 700, marginTop: 8 }}>{vsLabel(m)}</h3>
      <div className="mini"><b>{m.team_a?.short_name ?? "TBD"}</b><span className="num">{scoreText(m)}</span><b className="e">{m.team_b?.short_name ?? "TBD"}</b></div>
      <div className="mf" style={{ marginBottom: 10 }}><span>{when(m)}</span><span>{m.court.name}</span></div>
      <Link className="btn p" style={{ width: "100%" }} href={href}>{cta}</Link>
    </article>
  );
}

export function MatchTable({ rows, hrefFor, title }: { rows: PublicMatch[]; hrefFor: (m: PublicMatch) => string; title?: string }) {
  return (
    <section className="twrap">
      {title && <div style={{ padding: "14px 14px 6px" }}><h2 style={{ fontSize: 16.5 }}>{title}</h2></div>}
      <table>
        <thead><tr><th>Match</th><th>When</th><th>Venue</th><th>Score</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead>
        <tbody>
          {rows.map((m) => (
            <tr key={m.id}>
              <td className="w" data-l="Match">{vsLabel(m)}<small>{m.sport.name}, {m.round}</small></td>
              <td data-l="When">{when(m)}</td>
              <td data-l="Venue">{m.court.name}</td>
              <td data-l="Score"><b className="num" style={{ fontSize: 20 }}>{scoreText(m)}</b></td>
              <td data-l="Status"><StatusPill status={m.status} /></td>
              <td className="a"><div className="acts"><Link className="btn s sm" href={hrefFor(m)}>Open</Link></div></td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && <div className="none">No matches here.</div>}
    </section>
  );
}
