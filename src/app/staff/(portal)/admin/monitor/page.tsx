import { requireRole } from "@/auth/request";
import { getLiveSnapshot } from "@/data/matches";
import { listPics } from "@/data/people";
import { LiveMonitor } from "@/components/portal/LiveMonitor";

export const metadata = { title: "Live Monitoring · ArenaHub" };

export default async function MonitorPage() {
  await requireRole("admin");
  const pics = listPics().filter((p) => p.active);
  const snap = getLiveSnapshot();
  const picFor = Object.fromEntries(snap.matches.map((m) => [m.id, pics.filter((p) => p.matchIds.includes(m.id) || p.courtIds.includes(m.court.id)).map((p) => p.name).join(", ")]));
  return (
    <>
      <div className="ph"><div><h1>Live Monitoring</h1><p>Every match in progress, refreshed every 10 seconds, with the PIC responsible.</p></div></div>
      <LiveMonitor snapshot={snap} picFor={picFor} />
    </>
  );
}
