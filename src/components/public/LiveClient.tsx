"use client";

import { useState } from "react";
import { dict, fmtDay, fmtTime, pick, type Lang } from "@/i18n";
import { LiveBadge } from "@/components/LiveBadge";
import { useLiveData } from "./LiveContext";
import { GoLink, RevealTitle } from "./PublicShell";
import { Clock, courtName, isLiveish, round, sportName, statusTag, teamLabel, useFlash } from "./matchView";

type Tab = "live" | "up" | "done";

export function LiveClient({ lang, featuredId, sports }: { lang: Lang; featuredId: string | null; sports: { id: string; name: string; name_bm: string }[] }) {
  const t = dict(lang);
  const { snapshot, stale, lastUpdated, offsetMs } = useLiveData();
  const [tab, setTab] = useState<Tab>("live");
  const [sport, setSport] = useState("all");
  const flash = useFlash(snapshot.matches);

  const all = snapshot.matches;
  const lists: Record<Tab, typeof all> = {
    live: all.filter(isLiveish),
    up: all.filter((m) => m.status === "upcoming").sort((a, b) => a.starts_at.localeCompare(b.starts_at)),
    done: all.filter((m) => m.status === "full_time").sort((a, b) => b.starts_at.localeCompare(a.starts_at)),
  };
  const rows = lists[tab].filter((m) => sport === "all" || m.sport.id === sport);
  const feat = all.find((m) => m.id === featuredId && isLiveish(m)) ?? lists.live[0];

  return (
    <div className="s-live">
      <section className="ph long">
        <RevealTitle text={t.live} />
        <p>{t.liveSub}</p>
        <div style={{ marginTop: 14 }}><LiveBadge lastUpdated={lastUpdated} stale={stale} labels={{ fresh: t.updated, ago: (s) => (s < 60 ? t.updated : t.updatedMin(Math.floor(s / 60))), reconnecting: t.reconnecting }} /></div>
      </section>

      {feat && (
        <GoLink className="feat" href={`/match/${feat.id}`} label={t.live} aria-label={`${t.openMatch}: ${teamLabel(feat.team_a, lang)} ${feat.score_a}, ${teamLabel(feat.team_b, lang)} ${feat.score_b}`}>
          <span className="fg">
            <span className="tn">{teamLabel(feat.team_a, lang)}</span>
            <span className="sc"><span className={`n${flash[feat.id]?.a ? " flash" : ""}`}>{feat.score_a}</span><span>-</span><span className={`n${flash[feat.id]?.b ? " flash" : ""}`}>{feat.score_b}</span></span>
            <span className="tn tz">{teamLabel(feat.team_b, lang)}</span>
          </span>
          <span className="fm">
            <span className={`tag ${statusTag(feat, lang).cls}`}>{feat.status === "live" && <i className="dot" />}{statusTag(feat, lang).label}, <Clock m={feat} offsetMs={offsetMs} /></span>
            <span>{sportName(feat, lang)}, {round(feat, lang)}, {courtName(feat, lang)}</span>
          </span>
        </GoLink>
      )}

      <section className="lb2">
        <div style={{ padding: "0 32px", display: "flex", flexDirection: "column", gap: 14 }} className="padx">
          <div className="tabs" role="group" aria-label={t.live}>
            {([["live", t.sLive], ["up", t.sUp], ["done", t.sDone]] as [Tab, string][]).map(([k, l]) => (
              <button key={k} className={`tb${tab === k ? " on" : ""}`} aria-pressed={tab === k} onClick={() => setTab(k)}>{l}<sup>{lists[k].length}</sup></button>
            ))}
          </div>
          <div className="bar">
            {[{ id: "all", name: t.allSports, name_bm: t.allSports }, ...sports].map((s) => (
              <button key={s.id} className={`chip${sport === s.id ? " on" : ""}`} aria-pressed={sport === s.id} onClick={() => setSport(s.id)}>{pick(lang, s)}</button>
            ))}
          </div>
        </div>
        <div data-testid="live-rows">
          {rows.map((m) => {
            const tag = statusTag(m, lang);
            const done = m.status === "full_time";
            const up = m.status === "upcoming";
            return (
              <GoLink key={m.id} className="row" href={`/match/${m.id}`} label={t.live}>
                <span className="sp">{sportName(m, lang)}<small>{round(m, lang)}</small></span>
                <span className={`ta${done && m.winner && m.winner !== m.team_a?.id ? " lose" : ""}`}>{teamLabel(m.team_a, lang)}</span>
                <span className="sc">
                  {up ? <span className="vs">{t.vs}</span> : <>
                    <span className={`n${flash[m.id]?.a ? " flash" : ""}`}>{m.score_a}</span><span>-</span><span className={`n${flash[m.id]?.b ? " flash" : ""}`}>{m.score_b}</span>
                  </>}
                </span>
                <span className={`tz${done && m.winner && m.winner !== m.team_b?.id ? " lose" : ""}`}>{teamLabel(m.team_b, lang)}</span>
                <span className="st">
                  <span className={`tag ${tag.cls}`}>{tag.dot && <i className="dot" />}{tag.label}</span>
                  <span>{isLiveish(m) ? <Clock m={m} offsetMs={offsetMs} /> : up ? `${fmtDay(m.starts_at, lang)}, ${fmtTime(m.starts_at)}` : courtName(m, lang)}</span>
                </span>
              </GoLink>
            );
          })}
          {rows.length === 0 && <div className="empty">{t.noMatch}</div>}
        </div>
      </section>
    </div>
  );
}
