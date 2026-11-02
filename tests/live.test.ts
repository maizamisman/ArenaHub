import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { GET } from "@/app/api/live/route";
import { applyScoreDelta, type LiveSnapshot } from "@/data/matches";
import { createLivePoller } from "@/lib/livePoller";
import { freshDb, userByEmail, matchId } from "./helpers";

describe("live snapshot endpoint", () => {
  it("snapshot version increases after a score change", async () => {
    const db = freshDb();
    const r1 = await GET();
    expect(r1.headers.get("Cache-Control")).toContain("no-store");
    const s1 = (await r1.json()) as LiveSnapshot;
    applyScoreDelta(userByEmail(db, "aina@arenahub.my"), matchId(db, "UM Laut", "UMT Laut", "Final"), "a", 1, crypto.randomUUID());
    const s2 = (await (await GET()).json()) as LiveSnapshot;
    expect(s2.version).toBeGreaterThan(s1.version);
    expect(s2.matches.find((m) => m.team_a?.short_name === "UM Laut" && m.round === "Final")?.score_a).toBe(3);
  });
});

const snap = (version: number): LiveSnapshot => ({ serverNow: new Date().toISOString(), version, matches: [], events: [] });

function fakeEnv() {
  const listeners: Record<string, (() => void)[]> = {};
  const target = {
    visibilityState: "visible" as "visible" | "hidden",
    addEventListener: (t: string, f: () => void) => { (listeners[t] ??= []).push(f); },
    removeEventListener: (t: string, f: () => void) => { listeners[t] = (listeners[t] ?? []).filter((x) => x !== f); },
    fire: (t: string) => (listeners[t] ?? []).forEach((f) => f()),
  };
  return target;
}

describe("useLive polling", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("useLive ignores an older version", async () => {
    const responses = [snap(4), snap(7)];
    const fetchFn = vi.fn(async () => new Response(JSON.stringify(responses.shift())));
    const env = fakeEnv();
    const seen: number[] = [];
    const poller = createLivePoller({ initial: snap(5), fetchFn, doc: env, win: env, onChange: (s) => seen.push(s.snapshot.version) });
    poller.start();

    await vi.advanceTimersByTimeAsync(10_000);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(poller.state().snapshot.version).toBe(5);

    await vi.advanceTimersByTimeAsync(10_000);
    expect(poller.state().snapshot.version).toBe(7);
    expect(seen).toContain(7);
    poller.stop();
  });

  it("does not poll while hidden and fetches at once when visible or back online", async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify(snap(9))));
    const env = fakeEnv();
    const poller = createLivePoller({ initial: snap(1), fetchFn, doc: env, win: env, onChange: () => {} });
    poller.start();
    env.visibilityState = "hidden";
    await vi.advanceTimersByTimeAsync(30_000);
    expect(fetchFn).not.toHaveBeenCalled();
    env.visibilityState = "visible";
    env.fire("visibilitychange");
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    env.fire("online");
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchFn).toHaveBeenCalledTimes(2);
    poller.stop();
  });

  it("two failed polls show reconnecting, a success clears it", async () => {
    let fail = true;
    const fetchFn = vi.fn(async () => { if (fail) throw new Error("offline"); return new Response(JSON.stringify(snap(3))); });
    const env = fakeEnv();
    const poller = createLivePoller({ initial: snap(1), fetchFn, doc: env, win: env, onChange: () => {} });
    poller.start();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(poller.state().stale).toBe(false);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(poller.state().stale).toBe(true);
    fail = false;
    await vi.advanceTimersByTimeAsync(10_000);
    expect(poller.state().stale).toBe(false);
    expect(poller.state().snapshot.version).toBe(3);
    poller.stop();
  });
});
