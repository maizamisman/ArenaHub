import { requireRole } from "@/auth/request";
import { listMatchesFor, matchLog } from "@/data/matches";
import { vsLabel, when } from "@/components/portal/MatchCards";
import { fmtTime } from "@/i18n";

export const metadata = { title: "Match History · ArenaHub" };

export default async function PicHistory() {
  const me = await requireRole("pic");
  const done = listMatchesFor(me).filter((m) => m.status === "full_time").sort((a, b) => b.starts_at.localeCompare(a.starts_at));
  return (
    <>
      <div className="ph"><div><h1>Match History</h1><p>Your completed matches and their scoring records.</p></div></div>
      <div className="twrap">
        <table>
          <thead><tr><th>Match</th><th>Final score</th><th>Result</th><th>Date</th></tr></thead>
          <tbody>
            {done.map((m) => {
              const w = m.winner === m.team_a?.id ? m.team_a : m.winner === m.team_b?.id ? m.team_b : null;
              const log = matchLog(m.id);
              return (
                <tr key={m.id}>
                  <td className="w" data-l="Match">{vsLabel(m)}<small>{m.sport.name}, {m.round}</small>
                    <details style={{ marginTop: 6, fontWeight: 400 }}>
                      <summary style={{ cursor: "pointer", color: "var(--royal)", fontSize: 13.5, minHeight: 44, display: "flex", alignItems: "center" }}>Score record ({log.length})</summary>
                      <div className="feed">{log.map((l) => <div key={l.id}>{l.text}{l.reason ? ` (${l.reason})` : ""}<small>{l.who}, {fmtTime(l.at)}</small></div>)}{log.length === 0 && <div>No changes were recorded in ArenaHub for this match.</div>}</div>
                    </details>
                  </td>
                  <td data-l="Final score"><b className="num" style={{ fontSize: 20 }}>{m.score_a} - {m.score_b}</b></td>
                  <td data-l="Result">{w ? `${w.short_name} won` : "Draw"}</td>
                  <td data-l="Date">{when(m)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {done.length === 0 && <div className="none">No completed matches yet.</div>}
      </div>
    </>
  );
}
