"use client";

import { useEffect, useRef } from "react";
import type { Court } from "@/data/public";
import { dict, directionsUrl, fmtTime, pick, type Lang } from "@/i18n";
import { useLiveData } from "./LiveContext";
import { sportName, teamLabel } from "./matchView";

// Fixed spots on the site plan, in court order. Courts beyond four get no highlight.
const SPOTS = [
  { x: 20, y: 24, w: 140, h: 116, fs: 13 },
  { x: 200, y: 24, w: 140, h: 58, fs: 12 },
  { x: 200, y: 92, w: 66, h: 50, fs: 10 },
  { x: 274, y: 92, w: 66, h: 50, fs: 10 },
];

export function SitePlan({ courts, active, lang }: { courts: Court[]; active?: string; lang: Lang }) {
  const t = dict(lang);
  const activeCourt = courts.find((c) => c.id === active);
  return (
    <svg viewBox="0 0 360 230" role="img" aria-label={`${t.planOf} ${activeCourt ? pick(lang, activeCourt) : t.siteName}`} style={{ display: "block", width: "100%", background: "#E9EFF9" }}>
      <path d="M20 160H340M180 20V160" stroke="#fff" strokeWidth="10" />
      {courts.slice(0, 4).map((c, i) => {
        const s = SPOTS[i];
        const name = pick(lang, c).split(" ").slice(0, s.w < 100 ? 1 : 3).join(" ");
        return (
          <g key={c.id}>
            <rect x={s.x} y={s.y} width={s.w} height={s.h} fill={c.id === active ? "#F6C90E" : "#C4D5EF"} stroke="#071B3A" strokeWidth="2" />
            <text x={s.x + s.w / 2} y={s.y + s.h / 2 + 4} textAnchor="middle" fontSize={s.fs} fontWeight="700" fill="#071B3A">{name}</text>
          </g>
        );
      })}
      <rect x="140" y="182" width="80" height="28" fill="#071B3A" />
      <text x="180" y="200" textAnchor="middle" fontSize="11" fontWeight="700" fill="#fff">{lang === "bm" ? "Pintu Utama" : "Main Gate"}</text>
    </svg>
  );
}

export function VenueModal({ court, courts, lang, onClose }: { court: Court; courts: Court[]; lang: Lang; onClose: () => void }) {
  const t = dict(lang);
  const { snapshot } = useLiveData();
  const closeRef = useRef<HTMLButtonElement>(null);
  const here = snapshot.matches.filter((m) => m.court.id === court.id && m.status === "upcoming").sort((a, b) => a.starts_at.localeCompare(b.starts_at)).slice(0, 5);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="scrim" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={pick(lang, court)}>
        <div className="mh">
          <div><h2 className="d">{pick(lang, court)}</h2><div style={{ fontSize: 14, color: "#44546E", marginTop: 4 }}>{t.siteName}{court.notes ? `. ${court.notes}` : ""}</div></div>
          <button ref={closeRef} className="x" onClick={onClose} aria-label={t.close}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg></button>
        </div>
        <SitePlan courts={courts} active={court.id} lang={lang} />
        {here.length > 0 && (
          <div><div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>{t.matchesHere}</div>
            {here.map((x) => <div key={x.id} style={{ display: "flex", gap: 10, fontSize: 14, padding: "3px 0" }}><b style={{ minWidth: 46 }}>{fmtTime(x.starts_at)}</b><span>{sportName(x, lang)}: {teamLabel(x.team_a, lang)} {t.vs} {teamLabel(x.team_b, lang)}</span></div>)}
          </div>
        )}
        <a className="btn b-n" href={directionsUrl(court.lat, court.lng)} target="_blank" rel="noopener" data-testid="maps-link">{t.openMaps}</a>
      </div>
    </div>
  );
}
