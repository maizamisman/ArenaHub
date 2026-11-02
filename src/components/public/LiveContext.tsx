"use client";

import { createContext, useContext, useEffect } from "react";
import { usePathname } from "next/navigation";
import type { LiveSnapshot } from "@/data/matches";
import type { LiveState } from "@/lib/livePoller";
import { useLive } from "@/lib/useLive";
import type { Lang } from "@/i18n";

type Ctx = LiveState & { lang: Lang; refresh: () => Promise<void> };
const LiveCtx = createContext<Ctx | null>(null);

/** One poller for the whole public site, so every page and the nav badge share the same data. */
export function LiveProvider({ initial, lang, children }: { initial: LiveSnapshot; lang: Lang; children: React.ReactNode }) {
  const live = useLive(initial);
  const path = usePathname();
  const { refresh } = live;
  // Moving to another page fetches at once instead of waiting for the next tick.
  useEffect(() => { void refresh(); }, [path]); // eslint-disable-line react-hooks/exhaustive-deps
  return <LiveCtx.Provider value={{ ...live, lang }}>{children}</LiveCtx.Provider>;
}

export function useLiveData(): Ctx {
  const c = useContext(LiveCtx);
  if (!c) throw new Error("useLiveData must be used inside LiveProvider");
  return c;
}
