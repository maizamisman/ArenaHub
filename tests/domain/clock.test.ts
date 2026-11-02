import { describe, it, expect } from "vitest";
import { matchClock, clientClockOffset } from "@/domain/clock";

const T0 = Date.parse("2027-03-14T07:00:00.000Z");

describe("clock", () => {
  it("clock adds running time only while live", () => {
    const started = new Date(T0).toISOString();
    expect(matchClock({ status: "live", clock_started_at: started, clock_elapsed_ms: 60_000 }, T0 + 30_000)).toBe(90_000);
    expect(matchClock({ status: "paused", clock_started_at: null, clock_elapsed_ms: 60_000 }, T0 + 30_000)).toBe(60_000);
    expect(matchClock({ status: "upcoming", clock_started_at: null, clock_elapsed_ms: 0 }, T0)).toBe(0);
  });

  it("clock uses server offset", () => {
    const m = { status: "live" as const, clock_started_at: new Date(T0).toISOString(), clock_elapsed_ms: 0 };
    const serverNow = T0 + 60_000;
    const clientNow = serverNow + 5 * 60_000; // phone clock 5 minutes fast
    const offset = clientClockOffset(serverNow, clientNow);
    expect(matchClock(m, clientNow + offset)).toBe(60_000);
  });
});
