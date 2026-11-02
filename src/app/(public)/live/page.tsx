import { getLang } from "@/i18n/server";
import { getSettings } from "@/data/settings";
import { listSports } from "@/data/public";
import { LiveClient } from "@/components/public/LiveClient";
import { dict } from "@/i18n";

export async function generateMetadata() {
  return { title: `${dict(await getLang()).live} · ArenaHub` };
}

export default async function LivePage() {
  const lang = await getLang();
  return <LiveClient lang={lang} featuredId={getSettings().featured_match_id} sports={listSports().map((s) => ({ id: s.id, name: s.name, name_bm: s.name_bm }))} />;
}
