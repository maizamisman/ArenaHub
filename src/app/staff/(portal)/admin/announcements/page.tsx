import { requireRole } from "@/auth/request";
import { listAllAnnouncements } from "@/data/content";
import { EntityManager } from "@/components/portal/EntityManager";
import { saveAnnouncementAction, deleteAnnouncementAction } from "@/app/staff/actions/admin";
import { fmtDay, fmtTime } from "@/i18n";

export const metadata = { title: "Announcements · ArenaHub" };

export default async function AnnouncementsPage() {
  await requireRole("admin");
  const rows = listAllAnnouncements().map((a) => ({
    id: a.id,
    values: { title: a.title, body: a.body, lang: a.lang, published: a.published },
    display: { title: a.title, body: a.body.length > 90 ? `${a.body.slice(0, 90)}…` : a.body, lang: a.lang === "en" ? "English" : "Bahasa Melayu", state: a.published ? "Published" : "Draft", at: `${fmtDay(a.updated_at, "en")}, ${fmtTime(a.updated_at)}` },
  }));
  return (
    <>
      <div className="ph"><div><h1>Announcements</h1><p>Shown from the announcements button on the public website, in the visitor&apos;s language.</p></div></div>
      <EntityManager noun="Announcement" rows={rows} save={saveAnnouncementAction} remove={deleteAnnouncementAction}
        columns={[{ key: "title", label: "Title", strong: true, sub: "body" }, { key: "lang", label: "Language" }, { key: "state", label: "Status" }, { key: "at", label: "Updated" }]}
        filters={[{ key: "lang", label: "Language", options: [{ value: "en", label: "English" }, { value: "bm", label: "Bahasa Melayu" }] }]}
        blank={{ title: "", body: "", lang: "en", published: true }}
        fields={[
          { key: "title", label: "Title", type: "text", required: true, full: true }, { key: "body", label: "Message", type: "textarea", required: true },
          { key: "lang", label: "Language", type: "select", required: true, options: [{ value: "en", label: "English" }, { value: "bm", label: "Bahasa Melayu" }] },
          { key: "published", label: "Publish on the public website", type: "checkbox" },
        ]} />
    </>
  );
}
