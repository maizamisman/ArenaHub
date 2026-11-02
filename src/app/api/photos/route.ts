import { NextResponse, type NextRequest } from "next/server";
import { uploadPhoto, listPublicPhotos, MAX_UPLOAD_BYTES } from "@/data/photos";
import { moduleOn } from "@/data/settings";
import { deviceFromRequest, withDeviceCookie, clientIp } from "@/lib/device";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const dev = deviceFromRequest(req);
  const sort = req.nextUrl.searchParams.get("sort") === "loved" ? "loved" : "new";
  return withDeviceCookie(NextResponse.json(listPublicPhotos(dev.hash, sort), { headers: { "Cache-Control": "no-store" } }), dev.newId);
}

export async function POST(req: NextRequest) {
  const dev = deviceFromRequest(req);
  const fail = (error: string, status = 400) => withDeviceCookie(NextResponse.json({ ok: false, error }, { status }), dev.newId);
  if (!moduleOn("photos")) return fail("Photo Share is switched off right now.", 403);
  // Refuse oversized bodies before reading them into memory.
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > MAX_UPLOAD_BYTES + 64 * 1024) return fail("That photo is over 10 MB. Choose a smaller one.", 413);

  let form: FormData;
  try { form = await req.formData(); } catch { return fail("The upload could not be read. Please try again."); }
  const file = form.get("file");
  if (!(file instanceof Blob)) return fail("Choose a photo first.");
  const r = uploadPhoto({
    bytes: new Uint8Array(await file.arrayBuffer()),
    caption: String(form.get("caption") ?? ""),
    consent: form.get("consent") === "yes",
    deviceHash: dev.hash,
    ip: clientIp(req),
  });
  return withDeviceCookie(NextResponse.json(r, { status: r.ok ? 200 : r.error.includes("hour") ? 429 : 400 }), dev.newId);
}
