"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { PublicMatch } from "@/data/matches";
import type { BracketSlot } from "@/domain/types";
import { createBracketAction, clearBracketAction, setSlotMatchAction } from "@/app/staff/actions/admin";
import { Dialog, useToast } from "./PortalShell";

const label = (m: PublicMatch) => `${m.round}: ${m.team_a?.short_name ?? "TBD"} vs ${m.team_b?.short_name ?? "TBD"}`;

export function BracketEditor({ sportId, slots, matches }: { sportId: string; slots: BracketSlot[]; matches: PublicMatch[] }) {
  const router = useRouter();
  const toast = useToast();
  const [size, setSize] = useState(4);
  const [clearing, setClearing] = useState(false);
  const run = async (p: Promise<{ ok: boolean; error?: string; message?: string }>) => {
    const r = await p;
    if (!r.ok) toast(r.error ?? "Something went wrong.", false); else { toast(r.message ?? "Saved."); router.refresh(); }
  };

  if (slots.length === 0) {
    return (
      <section className="card" style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 520 }}>
        <h2>No bracket yet</h2>
        <p style={{ fontSize: 14, color: "var(--mute)" }}>Choose how many matches the first knockout round has. Later rounds are added for you, down to the final.</p>
        <div className="fld"><label htmlFor="bk-n">First round</label>
          <select id="bk-n" className="inp" value={size} onChange={(e) => setSize(Number(e.target.value))}>
            <option value={1}>1 match (final only)</option><option value={2}>2 matches (semi-finals)</option><option value={4}>4 matches (quarter-finals)</option><option value={8}>8 matches (round of 16)</option>
          </select></div>
        <button className="btn p" style={{ alignSelf: "flex-start" }} onClick={() => run(createBracketAction(sportId, size))}>Create bracket</button>
      </section>
    );
  }

  const rounds = [...new Set(slots.map((s) => s.round_index))].sort((a, b) => a - b).map((ri) => slots.filter((s) => s.round_index === ri).sort((a, b) => a.slot_index - b.slot_index));
  const names = ["Final", "Semi-finals", "Quarter-finals", "Round of 16"];
  return (
    <>
      <section className="card"><div className="brk">
        {rounds.map((r, ri) => (
          <div className="col" key={ri}><h3>{names[rounds.length - 1 - ri] ?? `Round ${ri + 1}`}</h3><div className="ms">
            {r.map((s) => {
              const m = matches.find((x) => x.id === s.match_id);
              return (
                <div key={s.id} className="bm" style={{ padding: 8 }}>
                  <label className="lab" htmlFor={`slot-${s.id}`} style={{ display: "block", marginBottom: 4 }}>Slot {s.slot_index + 1}{s.feeds_side ? `, winner goes to side ${s.feeds_side.toUpperCase()}` : ""}</label>
                  <select id={`slot-${s.id}`} className="inp" value={s.match_id ?? ""} onChange={(e) => run(setSlotMatchAction(s.id, e.target.value || null))}>
                    <option value="">Empty</option>
                    {matches.map((x) => <option key={x.id} value={x.id}>{label(x)}</option>)}
                  </select>
                  {m && <span className="n">{m.status === "full_time" ? `Finished ${m.score_a}-${m.score_b}` : m.status === "upcoming" ? "Upcoming" : "In progress"}</span>}
                </div>
              );
            })}
          </div></div>
        ))}
      </div></section>
      <div><button className="btn dl" onClick={() => setClearing(true)}>Clear this bracket</button></div>
      {clearing && (
        <Dialog title="Clear this bracket?" alert onClose={() => setClearing(false)}
          footer={<><button className="btn s" onClick={() => setClearing(false)}>Cancel</button><button className="btn d" onClick={async () => { await run(clearBracketAction(sportId)); setClearing(false); }}>Clear bracket</button></>}>
          <p style={{ fontSize: 14.5, lineHeight: 1.5 }}>Matches are kept, but winners will no longer move on automatically until a new bracket is built.</p>
        </Dialog>
      )}
    </>
  );
}
