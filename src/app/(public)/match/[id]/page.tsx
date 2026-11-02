import { getLang } from "@/i18n/server";
import { listBracketSlots } from "@/data/public";
import { getPublicMatch } from "@/data/matches";
import { MatchClient } from "@/components/public/MatchClient";
import { NotAvailable } from "@/components/public/PublicShell";

export default async function MatchPage({ params }: PageProps<"/match/[id]">) {
  const { id } = await params;
  const lang = await getLang();
  if (!getPublicMatch(id)) return <NotAvailable lang={lang} />;
  return <MatchClient lang={lang} id={id} slots={listBracketSlots()} />;
}
