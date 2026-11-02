import { requireRole } from "@/auth/request";
import { listForModeration } from "@/data/photos";
import { PhotoModeration } from "@/components/portal/PhotoModeration";

export const metadata = { title: "Photo Share · ArenaHub" };

export default async function PicPhotos() {
  await requireRole("pic");
  return (
    <>
      <div className="ph"><div><h1>Photo Share</h1><p>Delete posts that are not suitable, and approve ones waiting for review.</p></div></div>
      <PhotoModeration photos={listForModeration()} />
    </>
  );
}
