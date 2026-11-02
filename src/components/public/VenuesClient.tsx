"use client";

import { useState } from "react";
import type { Court } from "@/data/public";
import { dict, directionsUrl, fmtTime, pick, type Lang } from "@/i18n";
import { useLiveData } from "./LiveContext";
import { RevealTitle } from "./PublicShell";
import { SitePlan } from "./VenueModal";
import { isLiveish, sportName, teamLabel } from "./matchView";

export function VenuesClient({ lang, courts }: { lang: Lang; courts: Court[] }) {
  const t = dict(lang);
  const { snapshot } = useLiveData();
  const [active, setActive] = useState<string | undefined>(courts[0]?.id);
  return (
    <div className="s-sc">
      <section className="ph"><RevealTitle text={t.venues} /><p>{t.venuesSub}</p></section>
      <div className="wrap">
        <div style={{ maxWidth: 720 }}><SitePlan courts={courts} active={active} lang={lang} /></div>
        <div className="vg">
          {courts.map((c) => {
            const now = snapshot.matches.find((m) => m.court.id === c.id && isLiveish(m));
            const next = snapshot.matches.filter((m) => m.court.id === c.id && m.status === "upcoming").sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0];
            return (
              <article className="vc" key={c.id} onMouseEnter={() => setActive(c.id)} onFocus={() => setActive(c.id)}>
                <h2 className="d">{pick(lang, c)}</h2>
                {c.notes && <p>{c.notes}</p>}
                {now && <p><span className="tag t-live"><i className="dot" />{t.sLive}</span> {sportName(now, lang)}: {teamLabel(now.team_a, lang)} {now.score_a}-{now.score_b} {teamLabel(now.team_b, lang)}</p>}
                {next && <p>{t.upNext}: {fmtTime(next.starts_at)}, {sportName(next, lang)}, {teamLabel(next.team_a, lang)} {t.vs} {teamLabel(next.team_b, lang)}</p>}
                <a className="btn b-s" href={directionsUrl(c.lat, c.lng)} target="_blank" rel="noopener">{t.openMaps}</a>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}
