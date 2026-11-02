"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useMemo, useRef, useState } from "react";
import { dict, fmtTime, pick, type Lang } from "@/i18n";
import { computeStandings } from "@/domain/standings";
import type { MedalResult, MedalRule, Team } from "@/domain/types";
import { useLiveData } from "./LiveContext";
import { GoLink, useShell } from "./PublicShell";
import { asMatch, teamLabel } from "./matchView";

const FLAGS = ["a", "r", "e", "n", "a", "h", "u", "b"];
const STEP = 360 / 8;

type Props = {
  lang: Lang; eventName: string; tagline: string; sections: string[]; photos: number; sportCount: number; unis: string[];
  standings: { teams: Team[]; rules: MedalRule[]; medalResults: MedalResult[]; sports: { id: string; name: string; name_bm: string }[] };
};

export function HomeClient({ lang, eventName, tagline, sections, standings, photos, sportCount, unis }: Props) {
  const t = dict(lang);
  const { snapshot } = useLiveData();
  const { still } = useShell();
  const live = snapshot.matches.filter((m) => m.status === "live");
  const upcoming = snapshot.matches.filter((m) => m.status === "upcoming").sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const leader = useMemo(() => {
    const rows = computeStandings({ ...standings, matches: snapshot.matches.map(asMatch) });
    return rows[0]?.gold ? rows[0] : null;
  }, [snapshot.matches, standings]);

  const vs = (m: (typeof live)[number]) => `${teamLabel(m.team_a, lang)} ${t.vs} ${teamLabel(m.team_b, lang)}`;
  const doors: Record<string, { href: string; label: string; info: string; img: string; dot?: boolean }> = {
    live: { href: "/live", label: t.live, info: live.length ? t.doorLive(live.length, vs(live[0])) : t.doorNoLive, img: "/moments/m0.jpg", dot: live.length > 0 },
    standings: { href: "/standings", label: t.standings, info: leader ? t.doorStand(leader.team, leader.gold) : t.doorNoStand, img: "/moments/m5.jpg" },
    schedule: { href: "/schedule", label: t.schedule, info: upcoming[0] ? t.doorSched(`${pick(lang, upcoming[0].sport)}, ${vs(upcoming[0])}`, fmtTime(upcoming[0].starts_at)) : t.doorNoSched, img: "/moments/m6.jpg" },
    photos: { href: "/photos", label: t.photos, info: t.doorPhotos(photos), img: "/moments/m1.jpg" },
  };

  // Hero video: muted autoplay, paused for reduced motion, with a play/pause toggle.
  const vid = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(true);
  useEffect(() => {
    const v = vid.current;
    if (!v) return;
    if (still) v.pause(); else v.play().catch(() => {});
  }, [still]);
  const toggleVid = () => {
    const v = vid.current;
    if (!v) return;
    if (v.paused) void v.play(); else v.pause();
  };

  const words = t.intro.split(" ");
  const [l1, l2] = splitTitle(eventName);
  const marquee = unis.concat(unis);

  return (
    <>
      <section className="hero" data-hero>
        <div className="hm" data-hm>
          <video ref={vid} src="/hero/arena-hero.mp4" poster="/hero/arena-hero-poster.jpg" autoPlay muted loop playsInline preload="metadata" aria-hidden="true" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} />
          <div className="ht" />
        </div>
        <div className="ho" data-ho />
        <div className="hc" data-hc>
          <h1 className="d" aria-label={eventName}>
            <span className="mk" style={{ "--d": 0.5 } as React.CSSProperties} aria-hidden="true"><span>{l1}</span></span>
            {l2 && <span className="mk" style={{ "--d": 0.62 } as React.CSSProperties} aria-hidden="true"><span>{l2}</span></span>}
          </h1>
          <div className="hf">
            <p className="tg">{tagline}</p>
            <div className="hb">
              <button className="vt" onClick={toggleVid} aria-label={playing ? t.pauseVid : t.playVid} aria-pressed={!playing}>
                {playing
                  ? <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 4h4v16H6zM14 4h4v16h-4z" /></svg>
                  : <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4v16l13-8Z" /></svg>}
              </button>
              <GoLink className="btn b-s" href="/live" label={t.live}><i className="dot" style={{ color: "#E5262F" }} />{t.live}</GoLink>
            </div>
          </div>
        </div>
      </section>

      <div className="mq" aria-hidden="true"><div className="mq-t">
        {marquee.map((u, i) => <span key={i} style={{ display: "contents" }}><span>{u}</span><img src={`/flags/flag-${FLAGS[i % 8]}.svg`} alt="" /></span>)}
      </div></div>

      <section className="mf">
        <TrackRings />
        <div className="wrap">
          <p className="tx" data-scrub aria-label={t.intro} style={{ "--n": words.length } as React.CSSProperties}>
            {words.map((w, i) => <span className="wd" aria-hidden="true" style={{ "--i": i } as React.CSSProperties} key={i}>{w} </span>)}
          </p>
          <div className="nums">
            <div className="rv"><b>{sportCount}</b><span>{t.sports}</span></div>
            <div className="rv"><b>{unis.length}</b><span>{t.unis}</span></div>
            <div className="rv"><b>{snapshot.matches.length}</b><span>{t.matches}</span></div>
          </div>
        </div>
      </section>

      <Moments lang={lang} still={still} />

      <nav className="dl" aria-label={t.sections}>
        {sections.map((k) => {
          const d = doors[k];
          if (!d) return null;
          return (
            <GoLink key={k} className="door" href={d.href} label={d.label}>
              <span className="d rx">{d.label}{d.dot && <i className="dot" />}</span>
              <span className="i">{d.info}</span>
              <img src={d.img} alt="" />
            </GoLink>
          );
        })}
      </nav>
    </>
  );
}

/** "Karnival Sukan KD Sri Klang 2027" → two balanced lines for the hero. */
function splitTitle(s: string): [string, string] {
  const w = s.split(" ");
  if (w.length < 3) return [s, ""];
  const cut = Math.ceil(w.length / 2) - (w.length > 4 ? 1 : 0);
  return [w.slice(0, cut).join(" "), w.slice(cut).join(" ")];
}

export function TrackRings() {
  return (
    <svg className="trk" data-rot viewBox="0 0 900 900" fill="none" aria-hidden="true"><g stroke="#8DB8FF" strokeWidth="3">
      <circle cx="450" cy="450" r="440" strokeDasharray="640 90" /><circle cx="450" cy="450" r="370" strokeDasharray="420 70" />
      <circle cx="450" cy="450" r="300" strokeDasharray="280 60" /><circle cx="450" cy="450" r="230" strokeDasharray="160 44" />
    </g></svg>
  );
}

/** Past moments on a slowly turning 3D ring: drag to spin, select to bring one forward. */
function Moments({ lang, still }: { lang: Lang; still: boolean }) {
  const t = dict(lang);
  const items = t.pastMoments;
  const [cur, setCur] = useState(0);
  const [liked, setLiked] = useState<Record<number, boolean>>({});
  const [view, setView] = useState<number | null>(null);
  const cyl = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);
  const st = useRef({ A: 0, tgt: null as number | null, holdTill: 0, hover: false, drag: null as null | { x: number; moved: number }, dragged: false });

  useEffect(() => {
    // Read after mount so the server render and first client render match.
    const id = setTimeout(() => { try { setLiked(JSON.parse(localStorage.getItem("ah_moment_likes") || "{}")); } catch { /* ignore */ } }, 0);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    const s = st.current;
    let raf = 0;
    const loop = (ts: number) => {
      raf = requestAnimationFrame(loop);
      const c = cyl.current, r = ring.current;
      if (!c || !r) return;
      const b = c.getBoundingClientRect();
      if (b.bottom < 0 || b.top > window.innerHeight) return;
      if (s.tgt !== null) {
        s.A += (s.tgt - s.A) * 0.085;
        if (Math.abs(s.tgt - s.A) < 0.05) { s.A = s.tgt; s.tgt = null; s.holdTill = ts + 6000; }
      } else if (!still && !s.drag && !s.hover && ts > s.holdTill) s.A -= 0.07;
      r.style.transform = `rotateY(${s.A.toFixed(3)}deg)`;
      const i = ((Math.round(-s.A / STEP) % 8) + 8) % 8;
      setCur((p) => (p === i ? p : i));
    };
    raf = requestAnimationFrame(loop);
    const move = (e: PointerEvent) => {
      if (!s.drag) return;
      const dx = e.clientX - s.drag.x;
      s.drag.x = e.clientX; s.drag.moved += Math.abs(dx);
      if (s.drag.moved > 6) s.dragged = true;
      s.A += dx * 0.16; s.holdTill = 0;
    };
    const upH = () => { s.drag = null; cyl.current?.classList.remove("drag"); };
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerup", upH);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", upH); };
  }, [still]);

  const spinTo = (i: number) => {
    const s = st.current;
    const want = -i * STEP, d = ((want - s.A) % 360 + 540) % 360 - 180;
    s.tgt = s.A + d; s.holdTill = Infinity;
    if (still) { s.A = s.tgt; s.tgt = null; }
    setCur(i);
  };
  const like = (i: number) => {
    const next = { ...liked, [i]: !liked[i] };
    setLiked(next);
    try { localStorage.setItem("ah_moment_likes", JSON.stringify(next)); } catch { /* ignore */ }
  };
  const m = items[cur];

  return (
    <section className="mo" aria-label={t.moments}>
      <h2 className="d rv">{t.moments}</h2>
      <div className="cyl" ref={cyl}
        onPointerEnter={(e) => { if (e.pointerType === "mouse") st.current.hover = true; }}
        onPointerLeave={() => { st.current.hover = false; }}
        onPointerDown={(e) => { st.current.drag = { x: e.clientX, moved: 0 }; st.current.dragged = false; st.current.tgt = null; cyl.current?.classList.add("drag"); }}>
        <div className="tilt"><div className="ring" ref={ring}>
          {items.map((x, i) => (
            <button key={i} className={`pn${i === cur ? " on" : ""}`} style={{ transform: `rotateY(${i * STEP}deg) translateZ(calc(var(--r) * -1))` }}
              onClick={() => { if (!st.current.dragged) spinTo(i); }} aria-pressed={i === cur} aria-label={`${x.title}, ${x.year}`}>
              <img className="p" src={`/moments/m${i}.jpg`} alt="" draggable={false} />
              <img className="f" src={`/flags/flag-${FLAGS[i]}.svg`} alt="" />
            </button>
          ))}
        </div></div>
      </div>
      <div className="mc">
        <div><div className="d t" key={cur}>{m.title}</div><div className="s">{m.sport}, {m.year}</div></div>
        <div className="mr">
          <button className="mini" onClick={() => spinTo((cur + 7) % 8)} aria-label={t.prev}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg></button>
          <button className="mini" onClick={() => spinTo((cur + 1) % 8)} aria-label={t.next}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg></button>
          <button className={`mini${liked[cur] ? " on" : ""}`} onClick={() => like(cur)} aria-pressed={!!liked[cur]} aria-label={t.love}>
            <svg className="h" width="17" height="17" viewBox="0 0 24 24" strokeWidth="2.2" strokeLinejoin="round" aria-hidden="true"><path d="M20.8 5.6a5.5 5.5 0 0 0-7.8 0L12 6.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 22l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z" /></svg>
          </button>
          <button className="mini" onClick={() => setView(cur)}>{t.viewPhoto}</button>
        </div>
      </div>
      {view !== null && (
        <div className="scrim" onClick={(e) => { if (e.target === e.currentTarget) setView(null); }}>
          <div className="lb" role="dialog" aria-modal="true" aria-label={items[view].title}>
            <img src={`/moments/m${view}.jpg`} alt={items[view].title} />
            <button className="x" onClick={() => setView(null)} aria-label={t.close} autoFocus><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg></button>
            <div className="lb-b"><div><div className="t">{items[view].title}</div><div className="s">{items[view].sport}, {items[view].year}</div></div>
              <div className="lb-n"><button className="mini" onClick={() => setView((view + 7) % 8)}>{t.prev}</button><button className="mini" onClick={() => setView((view + 1) % 8)}>{t.next}</button></div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
