import Link from "next/link";
import { requireRole } from "@/auth/request";
import { listForModeration, storageUsedBytes } from "@/data/photos";
import { getSettings } from "@/data/settings";
import { PhotoModeration } from "@/components/portal/PhotoModeration";

export const metadata = { title: "Photo Share · ArenaHub" };

export default async function AdminPhotos() {
  await requireRole("admin");
  const s = getSettings();
  const mb = storageUsedBytes() / 1024 / 1024;
  return (
    <>
      <div className="ph"><div><h1>Photo Share</h1><p>Approve, delete and restore posts. Three reports send a post back for review automatically.</p></div>
        <Link className="btn s" href="/staff/admin/settings">Change in Screen Configuration</Link></div>
      <div className="g4">
        <div className="card stat"><b>{mb.toFixed(1)} MB</b><span>Photo storage used (free plan target: 1 GB)</span></div>
        <div className="card stat"><b>{s.photo_approval === "approval" ? "Check first" : "Instant"}</b><span>How new posts go live</span></div>
        <div className="card stat"><b>{s.modules.photos ? "Open" : "Closed"}</b><span>Photo Share on the website</span></div>
      </div>
      <PhotoModeration photos={listForModeration()} />
    </>
  );
}
