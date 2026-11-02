"use client";

import type { PublicMatch } from "@/data/matches";
import type { BracketSlot } from "@/domain/types";
import { dict, directionsUrl, fmtDayLong, fmtTime, roundGroupName, type Lang } from "@/i18n";
import { useLiveData } from "./LiveContext";
import { GoLink, NotAvailable } from "./PublicShell";
import { Clock, courtName, isLiveish, round, sportName, statusTag, teamLabel, useFlash } from "./matchView";

const EV_DOT: Record<string, string> = { goal: "g", point: "g", set: "s", card_yellow: "y", card_red: "c", substitution: "s", note: "" };

export function MatchClient({ lang, id, slots }: { lang: Lang; id: string; slots: BracketSlot[] }) {
  const t = dict(lang);
  const { snapshot, offsetMs } = useLiveData();
  const m = snapshot.matches.find((x) => x.id === id);
  const flash = useFlash(m ? [m] : []);
  if (!m) return <NotAvailable lang={lang} />;

  const tag = statusTag(m, lang);
  const a = teamLabel(m.team_a, lang), b = teamLabel(m.team_b, lang);
  const up = m.status === "upcoming";
  const teamName = (tid: string | null) => (tid === m.team_a?.id ? a : tid === m.team_b?.id ? b : "");
  const events = snapshot.events.filter((e) => e.match_id === id);
  const related = snapshot.matches.filter((x) => x.id !== id && (x.sport.id === m.sport.id || x.court.id === m.court.id)).slice(0, 4);

  return (
    <>
      <section className="ph" style={{ background: "#1F4FE0" }}>
        <GoLink className="back" href="/live" label={t.live}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>{t.backLive}
        </GoLink>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center", marginTop: 6 }}>
          <h1 style={{ fontSize: 18, fontWeight: 600 }}>{sportName(m, lang)}, {round(m, lang)}</h1>
          <span className={`tag ${tag.cls}`}>{tag.dot && <i className="dot" />}{tag.label}{isLiveish(m) && <>, <Clock m={m} offsetMs={offsetMs} /></>}</span>
        </div>
        <div className="bd" data-testid="match-score">
          <div className={m.status === "full_time" && m.winner !== m.team_a?.id ? "lose" : ""}><div className="tn">{a}</div><small>{m.team_a?.institution}</small></div>
          <div className="sc">{up ? <span style={{ font: "italic 300 .4em var(--archivo)" }}>{t.vs}</span> : <>
            <span className={`n${flash[m.id]?.a ? " flash" : ""}`}>{m.score_a}</span><span>-</span><span className={`n${flash[m.id]?.b ? " flash" : ""}`}>{m.score_b}</span>
          </>}</div>
          <div className={m.status === "full_time" && m.winner !== m.team_b?.id ? "lose" : ""} style={{ textAlign: "right" }}><div className="tn">{b}</div><small>{m.team_b?.institution}</small></div>
        </div>
        <div className="ban">{banner(m, snapshot.matches, slots, lang)}</div>
      </section>
      <div className="wrap"><div className="g2">
        <section><h2 className="d h2">{t.timeline}</h2>
          {events.length === 0 && <p style={{ marginTop: 14, color: "var(--pale)" }}>{t.noTimeline}</p>}
          <div className="tl">
            {events.map((e) => {
              const label = e.kind === "note" ? e.detail : `${t.ev[e.kind]}${e.team ? `: ${teamName(e.team)}` : ""}`;
              return (
                <div key={e.id} style={{ display: "contents" }}>
                  <div className="tl-t">{e.minute_label}</div>
                  <div className="tl-d"><i className={EV_DOT[e.kind]} /></div>
                  <div className="tl-b"><b>{label}</b>{e.kind !== "note" && <span>{e.detail}</span>}</div>
                </div>
              );
            })}
          </div>
        </section>
        <div className="side">
          <section><h2 className="d h2">{t.venueTime}</h2>
            <div style={{ marginTop: 8 }}>
              <div className="kv"><span>{t.date}</span><b>{fmtDayLong(m.starts_at, lang)}</b></div>
              <div className="kv"><span>{t.start}</span><b>{fmtTime(m.starts_at)}</b></div>
              <div className="kv"><span>{t.venue}</span><b>{courtName(m, lang)}</b></div>
            </div>
            <a className="lnk" href={directionsUrl(m.court.lat, m.court.lng)} target="_blank" rel="noopener">{t.openMaps}</a>
          </section>
          {related.length > 0 && (
            <section><h2 className="d h2">{t.other}</h2>
              <div style={{ marginTop: 8 }}>
                {related.map((x) => (
                  <GoLink key={x.id} className="ul" href={`/match/${x.id}`} label={t.live}>
                    <b>{teamLabel(x.team_a, lang)} {t.vs} {teamLabel(x.team_b, lang)}</b><small>{sportName(x, lang)}, {statusTag(x, lang).label}</small>
                  </GoLink>
                ))}
              </div>
            </section>
          )}
        </div>
      </div></div>
    </>
  );
}

/** One line on what is happening now, or what the result means for the next round. */
function banner(m: PublicMatch, all: PublicMatch[], slots: BracketSlot[], lang: Lang): string {
  const t = dict(lang);
  if (m.status === "live") return t.liveNote;
  if (m.status === "paused") return t.pausedNote;
  if (m.status === "half_time") return t.halfNote;
  const slot = slots.find((s) => s.match_id === m.id);
  const nextSlot = slot?.feeds_slot_id ? slots.find((s) => s.id === slot.feeds_slot_id) : undefined;
  const next = nextSlot?.match_id ? all.find((x) => x.id === nextSlot.match_id) : undefined;
  const nextName = next ? roundGroupName(next.round, lang).replace(/s$/, "") : "";
  if (m.status === "upcoming") {
    const base = t.starts(fmtTime(m.starts_at), fmtDayLong(m.starts_at, lang), courtName(m, lang));
    if (/^Final$/.test(m.round)) return `${base}. ${t.champ}`;
    return next ? `${base}. ${t.advAny(nextName)}` : base;
  }
  const w = m.winner === m.team_a?.id ? m.team_a : m.winner === m.team_b?.id ? m.team_b : null;
  const ft = w ? t.ftWon(w.short_name, Math.max(m.score_a, m.score_b), Math.min(m.score_a, m.score_b)) : t.ftDraw;
  if (w && /^Final$/.test(m.round)) return `${ft}. ${t.champs(w.short_name)}`;
  if (w && next) {
    const opp = slot!.feeds_side === "a" ? next.team_b : next.team_a;
    return `${ft}. ${t.adv(w.short_name, nextName, opp?.short_name)}`;
  }
  return ft;
}
