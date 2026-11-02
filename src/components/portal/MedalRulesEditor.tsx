"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { MedalRule } from "@/domain/types";
import { saveMedalRulesAction } from "@/app/staff/actions/admin";
import { useToast } from "./PortalShell";

type R = { round: string; medal: "gold" | "silver" | "bronze"; outcome: "winner" | "loser" };

export function MedalRulesEditor({ sports, rules }: { sports: { id: string; name: string }[]; rules: MedalRule[] }) {
  const router = useRouter();
  const toast = useToast();
  const [sport, setSport] = useState(sports[0]?.id ?? "");
  const [draft, setDraft] = useState<Record<string, R[]>>({});
  const list: R[] = draft[sport] ?? rules.filter((r) => r.sport_id === sport).map(({ round, medal, outcome }) => ({ round, medal, outcome }));
  const set = (next: R[]) => setDraft({ ...draft, [sport]: next });

  async function save() {
    const r = await saveMedalRulesAction(sport, list);
    if (!r.ok) { toast(r.error, false); return; }
    toast(r.message ?? "Saved.");
    setDraft({ ...draft, [sport]: undefined as unknown as R[] });
    router.refresh();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
      <div className="fld" style={{ maxWidth: 320 }}><label htmlFor="mr-s">Sport</label>
        <select id="mr-s" className="inp" value={sport} onChange={(e) => setSport(e.target.value)}>{sports.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
      {list.map((r, i) => (
        <div className="g-f" key={i} style={{ gridTemplateColumns: "minmax(0,1.4fr) minmax(0,1fr) minmax(0,1fr) auto", alignItems: "end" }}>
          <div className="fld"><label htmlFor={`mr-r${i}`}>Round</label><input id={`mr-r${i}`} className="inp" value={r.round} onChange={(e) => set(list.map((x, j) => (j === i ? { ...x, round: e.target.value } : x)))} /></div>
          <div className="fld"><label htmlFor={`mr-m${i}`}>Medal</label><select id={`mr-m${i}`} className="inp" value={r.medal} onChange={(e) => set(list.map((x, j) => (j === i ? { ...x, medal: e.target.value as R["medal"] } : x)))}><option value="gold">Gold</option><option value="silver">Silver</option><option value="bronze">Bronze</option></select></div>
          <div className="fld"><label htmlFor={`mr-o${i}`}>Goes to</label><select id={`mr-o${i}`} className="inp" value={r.outcome} onChange={(e) => set(list.map((x, j) => (j === i ? { ...x, outcome: e.target.value as R["outcome"] } : x)))}><option value="winner">Winner</option><option value="loser">Loser</option></select></div>
          <button className="btn dl sm" onClick={() => set(list.filter((_, j) => j !== i))} aria-label={`Remove rule ${i + 1}`}>Remove</button>
        </div>
      ))}
      {list.length === 0 && <p style={{ fontSize: 14, color: "var(--mute)" }}>No rules: matches in this sport award no medals. Use Medal Results for medal-only events.</p>}
      <div className="acts" style={{ justifyContent: "flex-start" }}>
        <button className="btn s" onClick={() => set([...list, { round: "Final", medal: "gold", outcome: "winner" }])}>Add rule</button>
        <button className="btn p" onClick={save}>Save rules</button>
      </div>
    </div>
  );
}
