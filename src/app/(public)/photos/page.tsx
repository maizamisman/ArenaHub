import { cookies } from "next/headers";
import { getLang } from "@/i18n/server";
import { getSettings } from "@/data/settings";
import { listPublicPhotos } from "@/data/photos";
import { DEVICE_COOKIE, hashDevice } from "@/lib/device";
import { PhotosClient } from "@/components/public/PhotosClient";
import { NotAvailable } from "@/components/public/PublicShell";
import { dict } from "@/i18n";

export async function generateMetadata() {
  return { title: `${dict(await getLang()).photos} · ArenaHub` };
}

export default async function PhotosPage() {
  const lang = await getLang();
  const s = getSettings();
  if (!s.modules.photos) return <NotAvailable lang={lang} />;
  const dev = (await cookies()).get(DEVICE_COOKIE)?.value;
  return <PhotosClient lang={lang} photos={listPublicPhotos(dev ? hashDevice(dev) : "")} approval={s.photo_approval === "approval"} />;
}
