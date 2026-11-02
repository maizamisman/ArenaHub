import { requireRole } from "@/auth/request";
import { listMedalResults } from "@/data/catalog";
import { listTeams } from "@/data/public";
import { getDb, plain } from "@/data/db";
import { EntityManager } from "@/components/portal/EntityManager";
import { saveMedalResultAction, deleteMedalResultAction } from "@/app/staff/actions/admin";

export const metadata = { title: "Medal Results · ArenaHub" };

export default async function MedalsPage() {
  await requireRole("admin");
  const sports = plain<{ id: string; name: string }>(getDb().prepare("SELECT id, name FROM sports ORDER BY sort, name").all());
  const teams = listTeams();
  const tn = (id: string | null) => teams.find((t) => t.id === id)?.short_name ?? "-";
  const rows = listMedalResults().map((r) => ({
    id: r.id,
    values: { sport_id: r.sport_id, event_name: r.event_name, gold: r.gold ?? "", silver: r.silver ?? "", bronze: r.bronze ?? "" },
    display: { event: r.event_name, sport: sports.find((s) => s.id === r.sport_id)?.name ?? "", gold: tn(r.gold), silver: tn(r.silver), bronze: tn(r.bronze) },
  }));
  const teamOpts = teams.map((t) => ({ value: t.id, label: t.short_name }));
  return (
    <>
      <div className="ph"><div><h1>Medal Results</h1><p>For events without a bracket, such as badminton singles or tug of war categories. Choose the medal teams; Standings update at once.</p></div></div>
      <EntityManager noun="Medal result" rows={rows} save={saveMedalResultAction} remove={deleteMedalResultAction}
        columns={[{ key: "event", label: "Event", strong: true, sub: "sport" }, { key: "gold", label: "Gold" }, { key: "silver", label: "Silver" }, { key: "bronze", label: "Bronze" }]}
        filters={[{ key: "sport_id", label: "Sport", options: sports.map((s) => ({ value: s.id, label: s.name })) }]}
        blank={{ sport_id: sports[0]?.id ?? "", event_name: "", gold: "", silver: "", bronze: "" }}
        fields={[
          { key: "sport_id", label: "Sport", type: "select", required: true, options: sports.map((s) => ({ value: s.id, label: s.name })) },
          { key: "event_name", label: "Event", type: "text", required: true, hint: "For example Men's Singles" },
          { key: "gold", label: "Gold", type: "select", required: true, options: teamOpts },
          { key: "silver", label: "Silver", type: "select", options: teamOpts }, { key: "bronze", label: "Bronze", type: "select", options: teamOpts },
        ]} />
    </>
  );
}
