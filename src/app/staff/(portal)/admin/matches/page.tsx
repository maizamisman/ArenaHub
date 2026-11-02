import { requireRole } from "@/auth/request";
import { listPublicMatches } from "@/data/matches";
import { listCourts, listTeams } from "@/data/public";
import { listPics } from "@/data/people";
import { getDb, plain } from "@/data/db";
import { EntityManager } from "@/components/portal/EntityManager";
import { saveMatchAction, deleteMatchAction } from "@/app/staff/actions/admin";
import { statusLabel } from "@/components/portal/status";
import { fmtDay, fmtTime, toMytInput } from "@/i18n";

export const metadata = { title: "Matches · ArenaHub" };

export default async function MatchesPage() {
  await requireRole("admin");
  const sports = plain<{ id: string; name: string }>(getDb().prepare("SELECT id, name FROM sports ORDER BY sort, name").all());
  const teams = listTeams();
  const courts = listCourts();
  const pics = listPics().filter((p) => p.active);
  const picFor = (id: string, court: string) => pics.filter((p) => p.matchIds.includes(id) || p.courtIds.includes(court)).map((p) => p.name).join(", ");
  const rows = listPublicMatches().map((m) => ({
    id: m.id,
    values: { sport_id: m.sport.id, round: m.round, group_name: m.group_name ?? "", team_a: m.team_a?.id ?? "", team_b: m.team_b?.id ?? "", court_id: m.court.id, starts_at: toMytInput(m.starts_at), pic: "", status: m.status },
    display: {
      match: `${m.team_a?.short_name ?? "To be decided"} vs ${m.team_b?.short_name ?? "To be decided"}`, detail: `${m.sport.name}, ${m.round}${m.group_name ? `, group ${m.group_name}` : ""}`,
      when: `${fmtDay(m.starts_at, "en")}, ${fmtTime(m.starts_at)}`, court: m.court.name, score: m.status === "upcoming" ? "-" : `${m.score_a} - ${m.score_b}`,
      status: statusLabel(m.status), pic: picFor(m.id, m.court.id) || "Not assigned",
    },
    canDelete: m.status === "upcoming",
    links: [{ label: "Score", href: `/staff/admin/score/${m.id}` }],
  }));
  const opt = (xs: { id: string; name?: string; short_name?: string }[]) => xs.map((x) => ({ value: x.id, label: x.name ?? x.short_name ?? x.id }));
  return (
    <>
      <div className="ph"><div><h1>Matches</h1><p>Create and schedule matches, and assign a PIC. Times are Malaysia time.</p></div></div>
      <EntityManager noun="Match" rows={rows} save={saveMatchAction} remove={deleteMatchAction} searchPlaceholder="Search by team, sport, court or PIC"
        columns={[{ key: "match", label: "Match", strong: true, sub: "detail" }, { key: "when", label: "When" }, { key: "court", label: "Court" }, { key: "score", label: "Score" }, { key: "status", label: "Status", pill: true }, { key: "pic", label: "PIC" }]}
        filters={[
          { key: "sport_id", label: "Sport", options: opt(sports) },
          { key: "status", label: "Status", options: ["upcoming", "live", "paused", "half_time", "full_time"].map((s) => ({ value: s, label: statusLabel(s) })) },
          { key: "court_id", label: "Court", options: opt(courts) },
        ]}
        blank={{ sport_id: sports[0]?.id ?? "", round: "", group_name: "", team_a: "", team_b: "", court_id: courts[0]?.id ?? "", starts_at: "2027-03-12T09:00", pic: "" }}
        fields={[
          { key: "sport_id", label: "Sport", type: "select", required: true, options: opt(sports) },
          { key: "round", label: "Round", type: "text", required: true, hint: "For example Semi-final 1, Final, Third place, Group stage" },
          { key: "team_a", label: "Team A", type: "select", options: opt(teams), hint: "Leave empty until decided" },
          { key: "team_b", label: "Team B", type: "select", options: opt(teams) },
          { key: "court_id", label: "Court", type: "select", required: true, options: opt(courts) },
          { key: "starts_at", label: "Start", type: "datetime", required: true },
          { key: "group_name", label: "Group", type: "text", hint: "Only for group stage matches, for example A" },
          { key: "pic", label: "Assign to PIC", type: "select", options: pics.map((p) => ({ value: p.id, label: p.name })), hint: "Adds this match to the PIC's assignments" },
        ]} />
    </>
  );
}
