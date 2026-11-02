import { getLang } from "@/i18n/server";
import { moduleOn } from "@/data/settings";
import { listBracketSlots, listSports, standingsInputs } from "@/data/public";
import { StandingsClient } from "@/components/public/StandingsClient";
import { NotAvailable } from "@/components/public/PublicShell";
import { dict } from "@/i18n";

export async function generateMetadata() {
  return { title: `${dict(await getLang()).standings} · ArenaHub` };
}

export default async function StandingsPage() {
  const lang = await getLang();
  if (!moduleOn("standings")) return <NotAvailable lang={lang} />;
  return <StandingsClient lang={lang} inputs={standingsInputs()} slots={listBracketSlots()} sports={listSports().map((s) => ({ id: s.id, name: s.name, name_bm: s.name_bm }))} />;
}
