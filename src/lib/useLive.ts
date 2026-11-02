"use client";

import { useEffect, useRef, useState } from "react";
import type { LiveSnapshot } from "@/data/matches";
import { createLivePoller, type LiveState } from "./livePoller";

/** Live data for public and portal pages: 10 second refresh with no page reload. */
export function useLive(initial: LiveSnapshot): LiveState & { refresh: () => Promise<void> } {
  const [state, setState] = useState<LiveState>(() => ({ snapshot: initial, stale: false, lastUpdated: new Date(), offsetMs: 0 }));
  const poller = useRef<ReturnType<typeof createLivePoller> | null>(null);

  useEffect(() => {
    const p = createLivePoller({ initial, onChange: setState });
    poller.current = p;
    p.start();
    return () => p.stop();
    // The server-rendered snapshot seeds the poller once; later data comes from polling.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { ...state, refresh: () => poller.current?.poll() ?? Promise.resolve() };
}
