"use client";

/* eslint-disable @next/next/no-img-element */
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ModPhoto } from "@/data/photos";
import { fmtDay, fmtTime } from "@/i18n";
import { moderate } from "@/app/staff/actions/photos";
import { Dialog, useToast } from "./PortalShell";

const LABEL = { pending: "Waiting for review", live: "On the wall", removed: "Removed" } as const;

export function PhotoModeration({ photos }: { photos: ModPhoto[] }) {
  const router = useRouter();
  const toast = useToast();
  const [filter, setFilter] = useState<"all" | ModPhoto["status"]>("all");
  const [confirm, setConfirm] = useState<ModPhoto | null>(null);
  const list = photos.filter((p) => filter === "all" || p.status === filter);
  const count = (s: ModPhoto["status"]) => photos.filter((p) => p.status === s).length;

  async function run(p: ModPhoto, action: "approve" | "remove" | "restore") {
    const r = await moderate(p.id, action);
    if (!r.ok) { toast(r.error ?? "Something went wrong.", false); return; }
    toast(action === "remove" ? "Photo removed from the wall." : "Photo is on the wall.");
    setConfirm(null);
    router.refresh();
  }

  return (
    <>
      <div className="chips" role="group" aria-label="Filter">
        {([["all", `All (${photos.length})`], ["pending", `Waiting (${count("pending")})`], ["live", `On the wall (${count("live")})`], ["removed", `Removed (${count("removed")})`]] as const).map(([k, l]) => (
          <button key={k} className={`chip${filter === k ? " on" : ""}`} aria-pressed={filter === k} onClick={() => setFilter(k)}>{l}</button>
        ))}
      </div>
      <div className="g3">
        {list.map((p) => (
          <article key={p.id} className={`pc${p.status === "removed" ? " gone" : ""}`}>
            <img src={p.src} alt={p.caption || "Photo"} loading="lazy" />
            <div className="b">
              <div className="mh"><span>{fmtDay(p.created_at, "en")}, {fmtTime(p.created_at)}</span><span className={`pill st-${p.status}`}>{LABEL[p.status]}</span></div>
              <p>{p.caption || <i style={{ color: "var(--mute)" }}>No description</i>}</p>
              <div className="mf"><span>{p.likes} likes</span>{p.reports > 0 && <span style={{ color: "var(--err)", fontWeight: 700 }}>{p.reports} reports</span>}{p.by_admin && <span>By organisers</span>}</div>
              <div className="acts">
                {p.status === "pending" && <button className="btn p sm" onClick={() => run(p, "approve")}>Approve</button>}
                {p.status === "removed" && <button className="btn s sm" onClick={() => run(p, "restore")}>Put back</button>}
                {p.status !== "removed" && <button className="btn dl sm" onClick={() => setConfirm(p)}>Delete</button>}
              </div>
            </div>
          </article>
        ))}
      </div>
      {list.length === 0 && <div className="card none">No photos here.</div>}
      {confirm && (
        <Dialog title="Delete this photo?" alert onClose={() => setConfirm(null)}
          footer={<><button className="btn s" onClick={() => setConfirm(null)}>Cancel</button><button className="btn d" onClick={() => run(confirm, "remove")}>Delete photo</button></>}>
          <p style={{ fontSize: 14.5, lineHeight: 1.5 }}>It disappears from the public Photo Share at once. The action is saved in the Audit Log.</p>
        </Dialog>
      )}
    </>
  );
}
