const STATUS_LABEL: Record<string, string> = { upcoming: "Upcoming", live: "Live", paused: "Paused", half_time: "Half Time", full_time: "Full Time" };

/** Plain-English match status, usable from server and client components. */
export const statusLabel = (s: string) => STATUS_LABEL[s] ?? s;
