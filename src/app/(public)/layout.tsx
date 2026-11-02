import "@/styles/public.css";
import { getLang } from "@/i18n/server";
import { getSettings } from "@/data/settings";
import { getLiveSnapshot } from "@/data/matches";
import { listAnnouncements } from "@/data/public";
import { LiveProvider } from "@/components/public/LiveContext";
import { PublicShell } from "@/components/public/PublicShell";

export const dynamic = "force-dynamic";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const lang = await getLang();
  const s = getSettings();
  return (
    <LiveProvider initial={getLiveSnapshot()} lang={lang}>
      <PublicShell lang={lang} modules={s.modules} announcements={s.modules.announcements ? listAnnouncements(lang) : []} eventName={s.event_name} organiser={s.organiser}>
        {children}
      </PublicShell>
    </LiveProvider>
  );
}
