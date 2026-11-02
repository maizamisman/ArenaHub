import { getLang } from "@/i18n/server";
import { listCourts } from "@/data/public";
import { moduleOn } from "@/data/settings";
import { VenuesClient } from "@/components/public/VenuesClient";
import { NotAvailable } from "@/components/public/PublicShell";
import { dict } from "@/i18n";

export async function generateMetadata() {
  return { title: `${dict(await getLang()).venues} · ArenaHub` };
}

export default async function VenuesPage() {
  const lang = await getLang();
  if (!moduleOn("venue_map")) return <NotAvailable lang={lang} />;
  return <VenuesClient lang={lang} courts={listCourts()} />;
}
