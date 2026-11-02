import { requireRole } from "@/auth/request";
import { getDb, plain } from "@/data/db";
import { listMedalRules } from "@/data/catalog";
import { EntityManager } from "@/components/portal/EntityManager";
import { MedalRulesEditor } from "@/components/portal/MedalRulesEditor";
import { saveSportAction, deleteSportAction } from "@/app/staff/actions/admin";
import type { Sport } from "@/data/public";

export const metadata = { title: "Sports · ArenaHub" };
const FORMAT = { knockout: "Knockout", group_knockout: "Group stage, then knockout", medal_only: "Medal results only" } as const;

export default async function SportsPage() {
  await requireRole("admin");
  const sports = plain<Sport>(getDb().prepare("SELECT * FROM sports ORDER BY sort, name").all());
  const counts = plain<{ sport_id: string; n: number }>(getDb().prepare("SELECT sport_id, COUNT(*) n FROM matches GROUP BY sport_id").all());
  const rows = sports.map((s) => ({
    id: s.id,
    values: { name: s.name, name_bm: s.name_bm, format: s.format, scoring: s.scoring, active: !!s.active, sort: s.sort },
    display: { name: s.name, name_bm: s.name_bm, format: FORMAT[s.format as keyof typeof FORMAT], scoring: s.scoring, matches: String(counts.find((c) => c.sport_id === s.id)?.n ?? 0), state: s.active ? "On" : "Off" },
    canDelete: !counts.some((c) => c.sport_id === s.id),
  }));
  return (
    <>
      <div className="ph"><div><h1>Sports</h1><p>Sports shown on the public website, their format and what is counted.</p></div></div>
      <EntityManager noun="Sport" rows={rows} save={saveSportAction} remove={deleteSportAction}
        columns={[{ key: "name", label: "Sport", strong: true, sub: "name_bm" }, { key: "format", label: "Format" }, { key: "scoring", label: "Counts" }, { key: "matches", label: "Matches" }, { key: "state", label: "Shown" }]}
        filters={[{ key: "format", label: "Format", options: Object.entries(FORMAT).map(([value, label]) => ({ value, label })) }]}
        blank={{ name: "", name_bm: "", format: "knockout", scoring: "Points", active: true, sort: sports.length }}
        fields={[
          { key: "name", label: "Name (English)", type: "text", required: true }, { key: "name_bm", label: "Name (Bahasa Melayu)", type: "text" },
          { key: "format", label: "Format", type: "select", required: true, options: Object.entries(FORMAT).map(([value, label]) => ({ value, label })) },
          { key: "scoring", label: "What is counted", type: "text", hint: "Goals, Points, Sets or Pulls" },
          { key: "sort", label: "Order on the website", type: "number" }, { key: "active", label: "Show this sport on the website", type: "checkbox" },
        ]} />
      <section className="card">
        <h2>Scoring rules</h2>
        <p style={{ fontSize: 14, color: "var(--mute)", marginTop: 4 }}>Which rounds award medals. Standings are worked out from these rules and finished matches; they are never typed in by hand.</p>
        <MedalRulesEditor sports={sports.map((s) => ({ id: s.id, name: s.name }))} rules={listMedalRules()} />
      </section>
    </>
  );
}
