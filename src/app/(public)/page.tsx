import { getLang } from "@/i18n/server";
import { getSettings } from "@/data/settings";
import { photoCount, standingsInputs, listSports } from "@/data/public";
import { HomeClient } from "@/components/public/HomeClient";

export default async function HomePage() {
  const lang = await getLang();
  const s = getSettings();
  const inputs = standingsInputs();
  const unis = inputs.teams.map((t) => t.institution);
  return (
    <HomeClient
      lang={lang}
      eventName={s.event_name}
      tagline={lang === "bm" ? s.tagline_bm || s.tagline : s.tagline}
      sections={s.home_sections.filter((k) => k === "live" || k === "schedule" || (k === "standings" && s.modules.standings) || (k === "photos" && s.modules.photos))}
      standings={inputs}
      photos={photoCount()}
      sportCount={listSports().length}
      unis={unis}
    />
  );
}
