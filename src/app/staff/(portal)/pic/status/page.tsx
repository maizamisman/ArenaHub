import { requireRole } from "@/auth/request";
import { listMatchesFor } from "@/data/matches";
import { StatusTable } from "@/components/portal/StatusTable";

export const metadata = { title: "Match Status · ArenaHub" };

const ORDER = { live: 0, paused: 1, half_time: 1, upcoming: 2, full_time: 3 } as const;

export default async function PicStatus() {
  const me = await requireRole("pic");
  const rows = listMatchesFor(me).sort((a, b) => ORDER[a.status] - ORDER[b.status] || a.starts_at.localeCompare(b.starts_at));
  return (
    <>
      <div className="ph"><div><h1>Match Status</h1><p>Start, pause, resume and end your matches. Ending asks you to confirm.</p></div></div>
      <StatusTable rows={rows} />
    </>
  );
}
