import { requireRole } from "@/auth/request";
import { listPics } from "@/data/people";
import { listPublicMatches } from "@/data/matches";
import { listCourts } from "@/data/public";
import { EntityManager } from "@/components/portal/EntityManager";
import { savePicAction, resetPicPasswordAction, deactivatePicAction, activatePicAction } from "@/app/staff/actions/admin";

export const metadata = { title: "PIC Accounts · ArenaHub" };

export default async function PicsPage() {
  await requireRole("admin");
  const matches = listPublicMatches();
  const courts = listCourts();
  const rows = listPics().map((p) => ({
    id: p.id,
    values: { name: p.name, email: p.email, matchIds: p.matchIds, courtIds: p.courtIds, active: p.active, inactive: !p.active },
    display: {
      name: p.name, email: p.email,
      assigned: [`${p.matchIds.length} matches`, ...p.courtIds.map((c) => courts.find((x) => x.id === c)?.name ?? "")].join(", "),
      state: p.active ? (p.must_change_password ? "Active, has not signed in yet" : "Active") : "Deactivated",
    },
  }));
  return (
    <>
      <div className="ph"><div><h1>PIC Accounts</h1><p>Each PIC gets a temporary password and chooses their own on first sign-in. Deactivating ends their access at once.</p></div></div>
      <EntityManager noun="PIC" rows={rows} save={savePicAction}
        columns={[{ key: "name", label: "Name", strong: true, sub: "email" }, { key: "assigned", label: "Assigned" }, { key: "state", label: "Status" }]}
        filters={[{ key: "active", label: "Status", options: [{ value: "true", label: "Active" }, { value: "false", label: "Deactivated" }] }]}
        blank={{ name: "", email: "", matchIds: [], courtIds: [] }}
        extra={[
          { label: "Reset password", action: resetPicPasswordAction, confirm: "Give a new temporary password to", when: "active" },
          { label: "Deactivate", action: deactivatePicAction, confirm: "Sign out and block", when: "active" },
          { label: "Activate", action: activatePicAction, confirm: "Allow sign-in again for", when: "inactive" },
        ]}
        fields={[
          { key: "name", label: "Name", type: "text", required: true }, { key: "email", label: "Email", type: "text", required: true },
          { key: "courtIds", label: "Courts (every match on these courts)", type: "multiselect", options: courts.map((c) => ({ value: c.id, label: c.name })) },
          { key: "matchIds", label: "Individual matches", type: "multiselect", options: matches.map((m) => ({ value: m.id, label: `${m.sport.name}, ${m.round}: ${m.team_a?.short_name ?? "TBD"} vs ${m.team_b?.short_name ?? "TBD"}` })) },
        ]} />
    </>
  );
}
