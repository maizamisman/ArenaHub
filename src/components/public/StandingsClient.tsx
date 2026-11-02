"use client";

import { useMemo, useState } from "react";
import { computeStandings } from "@/domain/standings";
import { groupTable } from "@/domain/group";
import type { BracketSlot, MedalResult, MedalRule, Team } from "@/domain/types";
import { dict, fmtDay, fmtTime, pick, roundGroupName, roundName, type Lang } from "@/i18n";
import { useLiveData } from "./LiveContext";
import { RevealTitle } from "./PublicShell";
import { asMatch, courtName, isLiveish, teamLabel } from "./matchView";

type Sport = { id: string; name: string; name_bm: string };
type Inputs = { teams: Team[]; rules: MedalRule[]; medalResults: MedalResult[]; sports: Sport[] };

export function StandingsClient({ lang, inputs, slots, sports }: { lang: Lang; inputs: Inputs; slots: BracketSlot[]; sports: Sport[] }) {
  const t = dict(lang);
  const { snapshot } = useLiveData();
  const [tab, setTab] = useState<"table" | "map">("table");
  const [open, setOpen] = useState<string | null>(null);

  const rows = useMemo(() => computeStandings({
    ...inputs, matches: snapshot.matches.map(asMatch),
    sports: inputs.sports.map((s) => ({ id: s.id, name: pick(lang, s) })),
  }), [inputs, snapshot.matches, lang]);
  const podium = rows.filter((r) => r.total > 0).slice(0, 3);

  return (
    <div className="s-st">
      <section className="ph"><RevealTitle text={t.standings} /><p>{t.standSub}</p></section>
      <div style={{ padding: "14px 32px 0" }} className="padx">
        <div className="tabs" role="group" aria-label={t.standings}>
          <button className={`tb${tab === "table" ? " on" : ""}`} aria-pressed={tab === "table"} onClick={() => setTab("table")}>{t.tMedals}</button>
          <button className={`tb${tab === "map" ? " on" : ""}`} aria-pressed={tab === "map"} onClick={() => setTab("map")}>{t.tMap}</button>
        </div>
      </div>

      {tab === "table" && <>
        {podium.length > 0 && (
          <div className="pods" style={{ marginTop: 20 }}>
            {podium.map((r, i) => (
              <button key={r.teamId} className={`pod rc r${i + 1}`} onClick={() => setOpen(r.teamId)} aria-label={`${r.rank}, ${r.team}`}>
                <span className="k">{r.rank}</span><span className="tn">{r.team}</span>
                <small><i className="md gold" />{r.gold}<i className="md silver" />{r.silver}<i className="md bronze" />{r.bronze}</small>
              </button>
            ))}
          </div>
        )}
        <div className="st-g" style={{ gap: 12 }}>
          <div role="table" aria-label={t.tMedals}>
            <div className="mt-h" role="row">
              <span role="columnheader">{t.rank}</span><span role="columnheader">{t.university}</span>
              <span role="columnheader"><i className="md gold" /><span className="lbl">{t.gold}</span></span>
              <span role="columnheader"><i className="md silver" /><span className="lbl">{t.silver}</span></span>
              <span role="columnheader"><i className="md bronze" /><span className="lbl">{t.bronze}</span></span>
              <span role="columnheader">{t.total}</span>
            </div>
            {rows.map((r) => {
              const isOpen = open === r.teamId;
              return (
                <div key={r.teamId} className={`mt-r${isOpen ? " open" : ""}`} role="rowgroup">
                  <div className="mt-l" role="row">
                    <span className="rk" role="cell">{r.rank}</span>
                    <span role="cell" style={{ minWidth: 0 }}>
                      <button className="uni" onClick={() => setOpen(isOpen ? null : r.teamId)} aria-expanded={isOpen}>
                        <span><b>{r.team}</b><small>{r.institution}</small></span>
                        <svg className={isOpen ? "up" : ""} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
                      </button>
                    </span>
                    <span role="cell" className={`nm${r.gold ? "" : " z"}`}>{r.gold}</span>
                    <span role="cell" className={`nm${r.silver ? "" : " z"}`}>{r.silver}</span>
                    <span role="cell" className={`nm${r.bronze ? "" : " z"}`}>{r.bronze}</span>
                    <span role="cell" className="nm t">{r.total}</span>
                  </div>
                  {isOpen && (r.medals.length
                    ? <div className="mt-x">{r.medals.map((x, i) => <div className="won" key={i}><i className={`md ${x.kind}`} /><span><b>{x.sport}</b><small>{t[x.kind]}, {roundName(x.event, lang)}</small></span></div>)}</div>
                    : <p style={{ padding: "0 32px 16px", fontSize: 14.5, color: "#44546E" }}>{t.noMedals}</p>)}
                </div>
              );
            })}
          </div>
          <p style={{ fontSize: 14.5, color: "#44546E", padding: "0 32px" }}>{t.rankRule}</p>
        </div>
      </>}

      {tab === "map" && <MatchMap lang={lang} slots={slots} sports={sports} />}
    </div>
  );
}

function MatchMap({ lang, slots, sports }: { lang: Lang; slots: BracketSlot[]; sports: Sport[] }) {
  const t = dict(lang);
  const { snapshot } = useLiveData();
  const withBracket = sports.filter((s) => slots.some((x) => x.sport_id === s.id) || snapshot.matches.some((m) => m.sport.id === s.id && m.group_name));
  const [sport, setSport] = useState(withBracket[0]?.id ?? "");
  const mine = slots.filter((s) => s.sport_id === sport);
  const rounds = [...new Set(mine.map((s) => s.round_index))].sort((a, b) => a - b).map((ri) => mine.filter((s) => s.round_index === ri).sort((a, b) => a.slot_index - b.slot_index));
  const byId = new Map(snapshot.matches.map((m) => [m.id, m]));
  const live = rounds.flat().map((s) => (s.match_id ? byId.get(s.match_id) : undefined)).find((m) => m && isLiveish(m));
  const [picked, setPicked] = useState<string | null>(null);
  const sel = byId.get(picked ?? "") ?? live ?? (rounds.at(-1)?.[0]?.match_id ? byId.get(rounds.at(-1)![0].match_id!) : undefined);
  const groups = [...new Set(snapshot.matches.filter((m) => m.sport.id === sport && m.group_name).map((m) => m.group_name!))];

  return (
    <div className="st-g padx" style={{ padding: "24px 32px 64px" }}>
      <div className="bar">
        {withBracket.map((s) => <button key={s.id} className={`chip${sport === s.id ? " on" : ""}`} aria-pressed={sport === s.id} onClick={() => { setSport(s.id); setPicked(null); }}>{pick(lang, s)}</button>)}
      </div>
      {groups.map((g) => (
        <section key={g}><h2 className="d h2">{t.groupTable} {g}</h2>
          <table className="gt"><thead><tr><th>{t.university}</th><th>{t.played}</th><th>{t.won}</th><th>{t.drawn}</th><th>{t.lost}</th><th>{t.points}</th></tr></thead>
            <tbody>{groupTable(snapshot.matches.map(asMatch), g).map((r) => {
              const team = snapshot.matches.flatMap((m) => [m.team_a, m.team_b]).find((x) => x?.id === r.team);
              return <tr key={r.team}><td>{team?.short_name ?? r.team}</td><td>{r.p}</td><td>{r.w}</td><td>{r.d}</td><td>{r.l}</td><td><b>{r.pts}</b></td></tr>;
            })}</tbody></table>
        </section>
      ))}
      {rounds.length > 0 && (
        <div className="g2" style={{ padding: "6px 0 0" }}>
          <section><div className="bk">
            {rounds.map((r, ri) => {
              const first = r.map((s) => byId.get(s.match_id ?? "")).find(Boolean);
              return (
                <div className="col" key={ri}><h3>{first ? roundGroupName(first.round, lang) : ""}</h3><div className="ms">
                  {r.map((s) => {
                    const m = s.match_id ? byId.get(s.match_id) : undefined;
                    if (!m) return <div className="bm" key={s.id}><span className="ln"><span>{t.tbd}</span></span><span className="ln"><span>{t.tbd}</span></span></div>;
                    const done = m.status === "full_time";
                    return (
                      <button key={s.id} className={`bm${sel?.id === m.id ? " on" : ""}`} onClick={() => setPicked(m.id)} aria-pressed={sel?.id === m.id}>
                        {isLiveish(m) && <span className="lv">{t.liveTag}</span>}
                        <span className={`ln${done && m.winner === m.team_a?.id ? " w" : ""}`}><span>{teamLabel(m.team_a, lang)}</span><b>{m.status === "upcoming" ? "" : m.score_a}</b></span>
                        <span className={`ln${done && m.winner === m.team_b?.id ? " w" : ""}`}><span>{teamLabel(m.team_b, lang)}</span><b>{m.status === "upcoming" ? "" : m.score_b}</b></span>
                      </button>
                    );
                  })}
                </div></div>
              );
            })}
          </div></section>
          {sel && (
            <section><h2 className="d h2">{roundName(sel.round, lang)}</h2>
              <div style={{ fontSize: 18, fontWeight: 700, marginTop: 8 }}>{teamLabel(sel.team_a, lang)} {t.vs} {teamLabel(sel.team_b, lang)}</div>
              <div style={{ marginTop: 8 }}>
                <div className="kv"><span>{t.score}</span><b>{sel.status === "upcoming" ? "-" : `${sel.score_a}-${sel.score_b}`}</b></div>
                <div className="kv"><span>{t.result}</span><b>{sel.status === "full_time" ? (sel.winner === sel.team_a?.id ? sel.team_a?.short_name : sel.team_b?.short_name) ?? t.ftDraw : isLiveish(sel) ? t.sLive : t.tbd}</b></div>
                <div className="kv"><span>{t.when}</span><b>{fmtDay(sel.starts_at, lang)}, {fmtTime(sel.starts_at)}</b></div>
                <div className="kv"><span>{t.venue}</span><b>{courtName(sel, lang)}</b></div>
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
