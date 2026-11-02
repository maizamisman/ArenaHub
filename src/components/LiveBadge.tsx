"use client";

import { useEffect, useState } from "react";

export type LiveBadgeLabels = { fresh: string; ago: (s: number) => string; reconnecting: string };

export const LIVE_BADGE_EN: LiveBadgeLabels = {
  fresh: "Updated a few seconds ago",
  ago: (s) => (s < 60 ? "Updated a few seconds ago" : `Updated ${Math.floor(s / 60)} min ago`),
  reconnecting: "Reconnecting",
};

/** Small status for live data; never asks people to refresh. */
export function LiveBadge({ lastUpdated, stale, labels = LIVE_BADGE_EN, className = "livebadge" }: {
  lastUpdated: Date; stale: boolean; labels?: LiveBadgeLabels; className?: string;
}) {
  const [now, setNow] = useState(() => lastUpdated.getTime());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 5_000);
    return () => clearInterval(t);
  }, []);
  const secs = Math.max(0, Math.round((now - lastUpdated.getTime()) / 1000));
  return (
    <span className={`${className}${stale ? " stale" : ""}`} role="status" aria-live="polite">
      <span className="lb-dot" aria-hidden="true" />
      {stale ? labels.reconnecting : labels.ago(secs)}
    </span>
  );
}
