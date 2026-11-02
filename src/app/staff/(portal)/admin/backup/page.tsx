import { requireRole } from "@/auth/request";
import { storageUsedBytes } from "@/data/photos";
import { defaultDbFile } from "@/data/db";

export const metadata = { title: "Backup · ArenaHub" };

export default async function BackupPage() {
  await requireRole("admin");
  return (
    <>
      <div className="ph"><div><h1>Backup</h1><p>Download everything ArenaHub holds: the database and every uploaded photo, in one zip file.</p></div></div>
      <section className="card" style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 680 }}>
        <h2>Download a backup</h2>
        <p style={{ fontSize: 14.5, lineHeight: 1.5 }}>During the carnival, download one at the end of each day and keep it somewhere other than this computer. Database: <code>{defaultDbFile()}</code>. Photos: {(storageUsedBytes() / 1024 / 1024).toFixed(1)} MB.</p>
        <a className="btn p" style={{ alignSelf: "flex-start" }} href="/staff/admin/backup/download" download>Download backup (.zip)</a>
        <p style={{ fontSize: 13.5, color: "var(--mute)", lineHeight: 1.5 }}>To restore: stop the website, replace <code>data/arenahub.db</code> with the file from the zip and copy the <code>uploads</code> folder into <code>data/</code>, then start it again.</p>
      </section>
    </>
  );
}
