import { requireRole } from "@/auth/request";
import { getDb, plain } from "@/data/db";
import { listCourts } from "@/data/public";
import { EntityManager } from "@/components/portal/EntityManager";
import { saveCourtAction, deleteCourtAction } from "@/app/staff/actions/admin";

export const metadata = { title: "Courts · ArenaHub" };

export default async function CourtsPage() {
  await requireRole("admin");
  const counts = plain<{ court_id: string; n: number }>(getDb().prepare("SELECT court_id, COUNT(*) n FROM matches GROUP BY court_id").all());
  const n = (id: string) => counts.find((c) => c.court_id === id)?.n ?? 0;
  const rows = listCourts().map((c) => ({
    id: c.id,
    values: { name: c.name, name_bm: c.name_bm, lat: c.lat, lng: c.lng, notes: c.notes },
    display: { name: c.name, name_bm: c.name_bm, gps: `${c.lat.toFixed(5)}, ${c.lng.toFixed(5)}`, matches: String(n(c.id)), notes: c.notes || "-" },
    canDelete: n(c.id) === 0,
    links: [{ label: "Check on Google Maps", href: `https://www.google.com/maps/search/?api=1&query=${c.lat},${c.lng}` }],
  }));
  return (
    <>
      <div className="ph"><div><h1>Courts</h1><p>Venues and their GPS position. Students get Google Maps directions from these coordinates, so check each one.</p></div></div>
      <EntityManager noun="Court" rows={rows} save={saveCourtAction} remove={deleteCourtAction}
        columns={[{ key: "name", label: "Court", strong: true, sub: "name_bm" }, { key: "gps", label: "GPS" }, { key: "matches", label: "Matches" }, { key: "notes", label: "Notes" }]}
        blank={{ name: "", name_bm: "", lat: 3.0006, lng: 101.3921, notes: "" }}
        fields={[
          { key: "name", label: "Name (English)", type: "text", required: true }, { key: "name_bm", label: "Name (Bahasa Melayu)", type: "text" },
          { key: "lat", label: "Latitude", type: "number", step: "0.00001", required: true, hint: "For example 3.00062" },
          { key: "lng", label: "Longitude", type: "number", step: "0.00001", required: true, hint: "For example 101.39214" },
          { key: "notes", label: "Notes for spectators", type: "textarea" },
        ]} />
    </>
  );
}
