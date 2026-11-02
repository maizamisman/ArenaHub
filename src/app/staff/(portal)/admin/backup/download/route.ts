import { getSessionUser } from "@/auth/request";
import { checkAccess } from "@/auth/guard";
import { exportBackup } from "@/data/backup";
import { getDb } from "@/data/db";
import { writeAudit } from "@/data/audit";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (checkAccess(user, "admin") !== "ok") return new Response("Only the Admin can download backups.", { status: 403 });
  const zip = exportBackup();
  writeAudit(getDb(), { userId: user!.id, action: "backup_download", after: { bytes: zip.length } });
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
  return new Response(new Uint8Array(zip), {
    headers: { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="arenahub-backup-${stamp}.zip"`, "Cache-Control": "no-store" },
  });
}
