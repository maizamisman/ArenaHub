"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { PublicMatch } from "@/data/matches";
import { changeStatus, type MatchResult } from "@/app/staff/actions/match";
import { StatusPill, useToast } from "./PortalShell";
import { EndDialog } from "./ScoreControl";
import { scoreText, vsLabel, when } from "./MatchCards";

/** Start, pause, resume and end matches from one table. */
export function StatusTable({ rows }: { rows: PublicMatch[] }) {
  const router = useRouter();
  const toast = useToast();
  const [ending, setEnding] = useState<PublicMatch | null>(null);
  const [busy, setBusy] = useState("");

  async function go(m: PublicMatch, to: "live" | "paused" | "half_time", ok: string) {
    setBusy(m.id);
    const r: MatchResult = await changeStatus(m.id, to).catch(() => ({ ok: false as const, error: "No connection. Please try again." }));
    setBusy("");
    if (!r.ok) toast(r.error, false); else { toast(ok); router.refresh(); }
  }

  return (
    <div className="twrap">
      <table>
        <thead><tr><th>Match</th><th>Score</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead>
        <tbody>
          {rows.map((m) => {
            const dis = busy === m.id;
            return (
              <tr key={m.id}>
                <td className="w" data-l="Match">{vsLabel(m)}<small>{m.sport.name}, {when(m)}</small></td>
                <td data-l="Score"><b className="num" style={{ fontSize: 20 }}>{scoreText(m)}</b></td>
                <td data-l="Status"><StatusPill status={m.status} /></td>
                <td className="a"><div className="acts">
                  {m.status === "upcoming" && <button className="btn p" disabled={dis || !m.team_a || !m.team_b} onClick={() => go(m, "live", "Match started.")}>Start</button>}
                  {m.status === "live" && <button className="btn or" disabled={dis} onClick={() => go(m, "paused", "Match paused.")}>Pause</button>}
                  {m.status === "live" && <button className="btn s" disabled={dis} onClick={() => go(m, "half_time", "Half time.")}>Half Time</button>}
                  {(m.status === "paused" || m.status === "half_time") && <button className="btn p" disabled={dis} onClick={() => go(m, "live", "Match resumed.")}>Resume</button>}
                  {(m.status === "live" || m.status === "paused") && <button className="btn d" disabled={dis} onClick={() => setEnding(m)}>End</button>}
                  {m.status === "full_time" && <span style={{ fontSize: 13.5, color: "#475569" }}>Completed</span>}
                </div></td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {rows.length === 0 && <div className="none">No matches assigned to you.</div>}
      {ending && <EndDialog m={ending} onClose={() => setEnding(null)} onDone={() => { setEnding(null); toast("Match ended. Standings are updated."); router.refresh(); }} />}
    </div>
  );
}
