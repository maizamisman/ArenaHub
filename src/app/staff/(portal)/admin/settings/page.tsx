import { requireRole } from "@/auth/request";
import { getSettings } from "@/data/settings";
import { listPublicMatches } from "@/data/matches";
import { SettingsForm } from "@/components/portal/SettingsForm";

export const metadata = { title: "Screen Configuration · ArenaHub" };

export default async function SettingsPage() {
  await requireRole("admin");
  const matches = listPublicMatches().map((m) => ({ id: m.id, label: `${m.sport.name}, ${m.round}: ${m.team_a?.short_name ?? "TBD"} vs ${m.team_b?.short_name ?? "TBD"}` }));
  return (
    <>
      <div className="ph"><div><h1>Screen Configuration</h1><p>What the public website shows. Changes apply as soon as you save.</p></div></div>
      <SettingsForm settings={getSettings()} matches={matches} />
    </>
  );
}
