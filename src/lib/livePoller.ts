import type { LiveSnapshot } from "@/data/matches";
import { clientClockOffset } from "@/domain/clock";

export const POLL_MS = 10_000;

export type LiveState = { snapshot: LiveSnapshot; stale: boolean; lastUpdated: Date; offsetMs: number };

type Events = { addEventListener(t: string, f: () => void): void; removeEventListener(t: string, f: () => void): void };

/**
 * Polls /api/live every 10 s while the page is visible, at once on returning to the tab or
 * regaining signal, and never moves backwards to an older version.
 */
export function createLivePoller(opts: {
  initial: LiveSnapshot;
  onChange: (s: LiveState) => void;
  fetchFn?: (url: string, init?: RequestInit) => Promise<Response>;
  doc?: Events & { visibilityState: string };
  win?: Events;
  url?: string;
}) {
  const fetchFn = opts.fetchFn ?? ((u, i) => fetch(u, i));
  const doc = opts.doc ?? document;
  const win = opts.win ?? window;
  const url = opts.url ?? "/api/live";
  let state: LiveState = {
    snapshot: opts.initial, stale: false, lastUpdated: new Date(),
    offsetMs: clientClockOffset(Date.parse(opts.initial.serverNow), Date.now()),
  };
  let failures = 0;
  let timer: ReturnType<typeof setInterval> | undefined;
  let inFlight = false;

  const set = (next: Partial<LiveState>) => { state = { ...state, ...next }; opts.onChange(state); };

  async function poll() {
    if (inFlight) return;
    inFlight = true;
    try {
      const res = await fetchFn(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const snap = (await res.json()) as LiveSnapshot;
      failures = 0;
      if (snap.version >= state.snapshot.version) {
        set({ snapshot: snap, stale: false, lastUpdated: new Date(), offsetMs: clientClockOffset(Date.parse(snap.serverNow), Date.now()) });
      } else if (state.stale) {
        set({ stale: false });
      }
    } catch {
      failures++;
      if (failures >= 2 && !state.stale) set({ stale: true });
    } finally {
      inFlight = false;
    }
  }

  const onVisible = () => { if (doc.visibilityState === "visible") void poll(); };
  const onOnline = () => void poll();

  return {
    start() {
      timer = setInterval(() => { if (doc.visibilityState === "visible") void poll(); }, POLL_MS);
      doc.addEventListener("visibilitychange", onVisible);
      win.addEventListener("online", onOnline);
    },
    stop() {
      clearInterval(timer);
      doc.removeEventListener("visibilitychange", onVisible);
      win.removeEventListener("online", onOnline);
    },
    poll,
    state: () => state,
  };
}
