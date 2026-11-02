import { getLang } from "@/i18n/server";
import { listCourts, listSports } from "@/data/public";
import { moduleOn } from "@/data/settings";
import { ScheduleClient } from "@/components/public/ScheduleClient";
import { dict } from "@/i18n";

export async function generateMetadata() {
  return { title: `${dict(await getLang()).schedule} · ArenaHub` };
}

export default async function SchedulePage() {
  const lang = await getLang();
  return <ScheduleClient lang={lang} courts={listCourts()} venueMap={moduleOn("venue_map")} sports={listSports().map((s) => ({ id: s.id, name: s.name, name_bm: s.name_bm }))} />;
}
