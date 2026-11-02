"use client";

import { useState } from "react";
import type { Court } from "@/data/public";
import { dayKey, dict, fmtDayLong, fmtTime, pick, type Lang } from "@/i18n";
import { useLiveData } from "./LiveContext";
import { RevealTitle } from "./PublicShell";
import { TrackRings } from "./HomeClient";
import { VenueModal } from "./VenueModal";
import { courtName, round, sportName, teamLabel } from "./matchView";

export function ScheduleClient({ lang, courts, venueMap, sports }: { lang: Lang; courts: Court[]; venueMap: boolean; sports: { id: string; name: string; name_bm: string }[] }) {
  const t = dict(lang);
  const { snapshot } = useLiveData();
  const [sport, setSport] = useState("all");
  const [venue, setVenue] = useState<Court | null>(null);

  const upcoming = snapshot.matches
    .filter((m) => m.status === "upcoming" && (sport === "all" || m.sport.id === sport))
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  // Group by start time; the first group is "Up next".
  const slots: { key: string; iso: string; rows: typeof upcoming }[] = [];
  for (const m of upcoming) {
    const key = `${dayKey(m.starts_at)} ${fmtTime(m.starts_at)}`;
    const last = slots.at(-1);
    if (last?.key === key) last.rows.push(m); else slots.push({ key, iso: m.starts_at, rows: [m] });
  }

  return (
    <div className="s-sc">
      <TrackRings />
      <section className="ph"><RevealTitle text={t.schedule} /><p>{t.schedSub}</p></section>
      <div style={{ padding: "6px 32px 10px", position: "relative" }} className="padx">
        <div className="bar">
          {[{ id: "all", name: t.allSports, name_bm: t.allSports }, ...sports].map((s) => (
            <button key={s.id} className={`chip${sport === s.id ? " on" : ""}`} aria-pressed={sport === s.id} onClick={() => setSport(s.id)}>{pick(lang, s)}</button>
          ))}
        </div>
      </div>
      <div className="wrap tlw" data-scrub>
        <div className="rail" aria-hidden="true"><i /></div>
        {slots.map((g, gi) => (
          <section className="slot rv" key={g.key} aria-label={`${gi === 0 ? `${t.upNext}, ` : ""}${fmtTime(g.iso)}`}>
            <div className="slot-t">
              {gi === 0 && <em className="tag t-live">{t.upNext}</em>}
              <b>{fmtTime(g.iso)}</b><span>{fmtDayLong(g.iso, lang)}</span>
            </div>
            <div>
              {g.rows.map((m) => (
                <div className="sr" key={m.id}>
                  <span className="spn">{sportName(m, lang)}</span>
                  <span className="who"><b>{teamLabel(m.team_a, lang)}<i>{t.vs}</i>{teamLabel(m.team_b, lang)}</b><span>{round(m, lang)}</span></span>
                  {venueMap ? (
                    <button className="loc" onClick={() => setVenue(courts.find((c) => c.id === m.court.id) ?? null)}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21Z" /><circle cx="12" cy="9.5" r="2.5" /></svg>
                      {courtName(m, lang)}
                    </button>
                  ) : <span className="loc" style={{ border: 0 }}>{courtName(m, lang)}</span>}
                </div>
              ))}
            </div>
          </section>
        ))}
        {slots.length === 0 && <div className="empty">{sport === "all" ? t.noUpcoming : t.noMatch}</div>}
      </div>
      {venue && <VenueModal court={venue} courts={courts} lang={lang} onClose={() => setVenue(null)} />}
    </div>
  );
}
