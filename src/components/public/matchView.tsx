"use client";

import { useEffect, useRef, useState } from "react";
import type { PublicMatch } from "@/data/matches";
import { formatClock, matchClock } from "@/domain/clock";
import { dict, pick, roundName, type Lang } from "@/i18n";
import type { Match } from "@/domain/types";

/** Back to the domain shape so pure rules (standings, groups) can run in the browser. */
export function asMatch(m: PublicMatch): Match {
  return { ...m, sport_id: m.sport.id, team_a: m.team_a?.id ?? null, team_b: m.team_b?.id ?? null, court_id: m.court.id, updated_at: "" } as unknown as Match;
}

export const isLiveish = (m: PublicMatch) => m.status === "live" || m.status === "paused" || m.status === "half_time";

export function teamLabel(team: PublicMatch["team_a"], lang: Lang) {
  return team?.short_name ?? dict(lang).tbd;
}

export function statusTag(m: PublicMatch, lang: Lang): { cls: string; label: string; dot: boolean } {
  const t = dict(lang);
  switch (m.status) {
    case "live": return { cls: "t-live", label: t.sLive, dot: true };
    case "paused": return { cls: "t-paused", label: t.sPaused, dot: false };
    case "half_time": return { cls: "t-paused", label: t.sHalf, dot: false };
    case "upcoming": return { cls: "t-up", label: t.sUp, dot: false };
    default: return { cls: "t-done", label: t.sDone, dot: false };
  }
}

export const sportName = (m: PublicMatch, lang: Lang) => pick(lang, m.sport);
export const courtName = (m: PublicMatch, lang: Lang) => pick(lang, m.court);
export const round = (m: PublicMatch, lang: Lang) => roundName(m.round, lang);

/** Match timer from the server's clock, ticking once a second while live. */
export function Clock({ m, offsetMs }: { m: PublicMatch; offsetMs: number }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const first = setTimeout(() => setNow(Date.now()), 0);
    if (m.status !== "live") return () => clearTimeout(first);
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => { clearTimeout(first); clearInterval(id); };
  }, [m.status]);
  const ms = matchClock(m, (now ?? Date.parse(m.clock_started_at ?? new Date(0).toISOString())) + offsetMs);
  return <span className="clk">{now === null && m.status === "live" ? formatClock(m.clock_elapsed_ms) : formatClock(ms)}</span>;
}

/** Which scores just changed, so they can flash once. */
export function useFlash(matches: PublicMatch[]): Record<string, { a: boolean; b: boolean }> {
  const prev = useRef<Map<string, [number, number]>>(new Map());
  const [flash, setFlash] = useState<Record<string, { a: boolean; b: boolean }>>({});
  useEffect(() => {
    const next: Record<string, { a: boolean; b: boolean }> = {};
    for (const m of matches) {
      const p = prev.current.get(m.id);
      if (p && (p[0] !== m.score_a || p[1] !== m.score_b)) next[m.id] = { a: p[0] !== m.score_a, b: p[1] !== m.score_b };
      prev.current.set(m.id, [m.score_a, m.score_b]);
    }
    if (Object.keys(next).length) {
      const on = setTimeout(() => setFlash(next), 0);
      const off = setTimeout(() => setFlash({}), 1400);
      return () => { clearTimeout(on); clearTimeout(off); };
    }
  }, [matches]);
  return flash;
}
