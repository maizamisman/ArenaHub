import { requireRole } from "@/auth/request";
import { getDb, plain } from "@/data/db";
import { listAudit } from "@/data/audit";
import { listPublicMatches } from "@/data/matches";
import { describeAudit } from "@/components/portal/auditText";
import { fmtDay, fmtTime } from "@/i18n";

export const metadata = { title: "Audit Log · ArenaHub" };

export default async function AuditPage({ searchParams }: PageProps<"/staff/admin/audit">) {
  await requireRole("admin");
  const sp = await searchParams;
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const f = { matchId: one("match"), userId: one("user"), from: one("from"), to: one("to") };
  const users = plain<{ id: string; name: string; role: string }>(getDb().prepare("SELECT id, name, role FROM users ORDER BY role, name").all());
  const matches = listPublicMatches();
  const rows = listAudit(getDb(), { ...f, limit: 500 });
  const pretty = (j: string | null) => {
    if (!j) return "";
    const o = JSON.parse(j);
    return Object.entries(o).filter(([, v]) => v !== null && typeof v !== "object").map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`).join(", ");
  };
  return (
    <>
      <div className="ph"><div><h1>Audit Log</h1><p>Every score, status, result and setting change: who, what, before, after, when and why. It cannot be edited.</p></div></div>
      <form className="tools" method="get" aria-label="Filter the audit log">
        <select name="match" className="inp" defaultValue={f.matchId} aria-label="Match">
          <option value="">All matches</option>{matches.map((m) => <option key={m.id} value={m.id}>{m.sport.name}, {m.round}: {m.team_a?.short_name ?? "TBD"} vs {m.team_b?.short_name ?? "TBD"}</option>)}
        </select>
        <select name="user" className="inp" defaultValue={f.userId} aria-label="User">
          <option value="">All people</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}{u.role === "admin" ? " (Admin)" : ""}</option>)}
        </select>
        <label className="lab" htmlFor="a-from">From</label><input id="a-from" name="from" type="date" className="inp" style={{ width: "auto" }} defaultValue={f.from} />
        <label className="lab" htmlFor="a-to">To</label><input id="a-to" name="to" type="date" className="inp" style={{ width: "auto" }} defaultValue={f.to} />
        <button className="btn p" type="submit">Filter</button>
        <a className="btn s" href="/staff/admin/audit">Clear</a>
      </form>
      <div className="twrap">
        <table>
          <thead><tr><th>When</th><th>Who</th><th>What</th><th>Before</th><th>After</th><th>Reason</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td data-l="When">{fmtDay(r.at, "en")}, {fmtTime(r.at)}</td>
                <td className="w" data-l="Who">{r.who}</td>
                <td data-l="What">{describeAudit(r)}</td>
                <td data-l="Before"><small>{pretty(r.before)}</small></td>
                <td data-l="After"><small>{pretty(r.after)}</small></td>
                <td data-l="Reason">{r.reason ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <div className="none">No entries match these filters.</div>}
      </div>
    </>
  );
}
