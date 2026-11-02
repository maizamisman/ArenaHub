import { requireRole } from "@/auth/request";
import { getDb, plain } from "@/data/db";
import { EntityManager } from "@/components/portal/EntityManager";
import { saveTeamAction, deleteTeamAction } from "@/app/staff/actions/admin";
import type { Team } from "@/domain/types";

export const metadata = { title: "Teams · ArenaHub" };

export default async function TeamsPage() {
  await requireRole("admin");
  const db = getDb();
  const teams = plain<Team & { manager: string }>(db.prepare("SELECT * FROM teams ORDER BY short_name").all());
  const counts = plain<{ id: string; n: number }>(db.prepare("SELECT t.id, COUNT(m.id) n FROM teams t LEFT JOIN matches m ON t.id IN (m.team_a, m.team_b) GROUP BY t.id").all());
  const n = (id: string) => counts.find((c) => c.id === id)?.n ?? 0;
  const rows = teams.map((t) => ({
    id: t.id,
    values: { short_name: t.short_name, institution: t.institution, manager: t.manager, active: !!t.active },
    display: { short_name: t.short_name, institution: t.institution, manager: t.manager || "-", matches: String(n(t.id)), state: t.active ? "Taking part" : "Withdrawn" },
    canDelete: n(t.id) === 0,
  }));
  return (
    <>
      <div className="ph"><div><h1>Teams</h1><p>Universities taking part. A team with matches can be withdrawn but not deleted.</p></div></div>
      <EntityManager noun="Team" rows={rows} save={saveTeamAction} remove={deleteTeamAction}
        columns={[{ key: "short_name", label: "Team", strong: true, sub: "institution" }, { key: "manager", label: "Manager" }, { key: "matches", label: "Matches" }, { key: "state", label: "Status" }]}
        filters={[{ key: "active", label: "Status", options: [{ value: "true", label: "Taking part" }, { value: "false", label: "Withdrawn" }] }]}
        blank={{ short_name: "", institution: "", manager: "", active: true }}
        fields={[
          { key: "short_name", label: "Short name", type: "text", required: true, hint: "Shown on scoreboards, for example UM Laut" },
          { key: "institution", label: "Institution", type: "text", required: true }, { key: "manager", label: "Team manager", type: "text" },
          { key: "active", label: "Taking part", type: "checkbox" },
        ]} />
    </>
  );
}
