import type { Match } from "./types.ts";

/** Elapsed match time in ms. Running time is added only while live. */
export function matchClock(m: Pick<Match, "status" | "clock_started_at" | "clock_elapsed_ms">, serverNowMs: number): number {
  if (m.status !== "live" || !m.clock_started_at) return m.clock_elapsed_ms;
  return m.clock_elapsed_ms + Math.max(0, serverNowMs - Date.parse(m.clock_started_at));
}

/** Add this to the device clock to get server time, so a wrong phone clock can't skew the timer. */
export function clientClockOffset(serverNowMs: number, clientNowMs: number): number {
  return serverNowMs - clientNowMs;
}

export function formatClock(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
