"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { LiveSnapshot, LogLine, PublicMatch, EventKind } from "@/data/matches";
import { useLive } from "@/lib/useLive";
import { formatClock, matchClock } from "@/domain/clock";
import { fmtDay, fmtTime } from "@/i18n";
import { scoreDelta, changeStatus, correct, undo, addMatchEvent, reopen, type MatchResult } from "@/app/staff/actions/match";
import { Dialog, StatusPill, useToast } from "./PortalShell";
import { LiveBadge } from "@/components/LiveBadge";

type Side = "a" | "b";
const EVENT_KINDS: [EventKind, string][] = [["goal", "Goal"], ["point", "Point"], ["card_yellow", "Yellow card"], ["card_red", "Red card"], ["set", "Set won"], ["substitution", "Substitution"], ["note", "Note"]];

export function ScoreControl({ initial, initialLog, snapshot, options, isAdmin }: {
  initial: PublicMatch; initialLog: LogLine[]; snapshot: LiveSnapshot; options: { id: string; label: string }[]; isAdmin: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const live = useLive(snapshot);
  const [confirmed, setConfirmed] = useState(initial);
  const [log, setLog] = useState(initialLog);
  const [pend, setPend] = useState({ a: 0, b: 0, n: 0 });
  const [dialog, setDialog] = useState<null | "end" | "correct" | "event" | "reopen">(null);
  const [busy, setBusy] = useState(false);

  // Newer data from polling (another device) wins, but not while our own taps are in flight.
  const polled = live.snapshot.matches.find((x) => x.id === initial.id);
  const m = pend.n === 0 && polled && polled.version > confirmed.version ? polled : confirmed;
  const sa = m.score_a + pend.a, sb = m.score_b + pend.b;
  const a = m.team_a?.short_name ?? "To be decided", b = m.team_b?.short_name ?? "To be decided";
  const isLive = m.status === "live";

  const accept = (r: MatchResult) => {
    if (!r.ok) { toast(r.error, false); return false; }
    setConfirmed((c) => (r.match.version >= c.version ? r.match : c));
    setLog(r.log);
    return true;
  };

  async function tap(side: Side, delta: 1 | -1) {
    if (!isLive) { toast("Scores change only while the match is live.", false); return; }
    if (delta === -1 && (side === "a" ? sa : sb) <= 0) { toast("The score is already 0.", false); return; }
    setPend((p) => ({ ...p, [side]: p[side] + delta, n: p.n + 1 }));
    const r = await scoreDelta(m.id, side, delta, crypto.randomUUID()).catch(() => ({ ok: false as const, error: "No connection. The tap was not saved." }));
    accept(r);
    setPend((p) => ({ ...p, [side]: p[side] - delta, n: p.n - 1 }));
  }

  async function act(p: Promise<MatchResult>, ok?: string) {
    setBusy(true);
    const r = await p.catch(() => ({ ok: false as const, error: "No connection. Please try again." }));
    setBusy(false);
    if (accept(r) && ok) toast(ok);
    return r;
  }

  const hint = m.status === "upcoming" ? "Start the match to begin scoring."
    : m.status === "paused" ? "The match is paused. Resume it to change the score."
    : m.status === "half_time" ? "Half time. Resume the match to change the score."
    : m.status === "full_time" ? (isAdmin ? "This match is finished. Reopen it to make changes." : "This match is finished. Only the Admin can reopen it.")
    : "";

  return (
    <>
      <div className="ph" style={{ alignItems: "flex-end" }}>
        <div><h1>Live Score Control</h1><p>{m.sport.name}, {m.round}, {m.court.name}</p></div>
        {options.length > 1 && (
          <div className="fld" style={{ flex: "1 1 240px", maxWidth: 420 }}>
            <label htmlFor="sc-m">Match</label>
            <select id="sc-m" className="inp" value={m.id} onChange={(e) => router.push(`/staff/${isAdmin ? "admin/score" : "pic/score"}/${e.target.value}`)}>
              {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </div>
        )}
      </div>
      <div className="mh">
        <span>{fmtDay(m.starts_at, "en")}, {fmtTime(m.starts_at)} · Clock <b className="num" style={{ fontSize: 18 }}><TickClock m={m} offsetMs={live.offsetMs} /></b></span>
        <StatusPill status={m.status} testId="match-status" />
      </div>
      {hint && <div className="card" style={{ background: "#FFEFE0", borderColor: "#FFC999", fontWeight: 600, fontSize: 14.5, padding: "11px 14px" }}>{hint}</div>}

      <div className="sg">
        {(["a", "b"] as Side[]).map((side) => {
          const team = side === "a" ? a : b;
          return (
            <section className="tm" aria-label={team} key={side}>
              <h3>{team}</h3>
              <div className="sr">
                <button className="minus" onClick={() => tap(side, -1)} disabled={!isLive} aria-label={`Minus 1 for ${team}`}>
                  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true"><path d="M5 12h14" /></svg>
                </button>
                <span className="big" aria-live="polite" style={{ textAlign: "center" }} data-testid={`score-${side}`}>{side === "a" ? sa : sb}</span>
                <button className="plus" onClick={() => tap(side, 1)} disabled={!isLive} aria-label={`Plus 1 for ${team}`}>
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
                </button>
              </div>
            </section>
          );
        })}
      </div>

      <div className="ctl">
        {m.status === "upcoming" && <button className="btn p" disabled={busy || !m.team_a || !m.team_b} onClick={() => act(changeStatus(m.id, "live"), "Match started.")}>Start match</button>}
        {isLive && <button className="btn or" disabled={busy} onClick={() => act(changeStatus(m.id, "paused"), "Match paused.")}>Pause match</button>}
        {isLive && <button className="btn s" disabled={busy} onClick={() => act(changeStatus(m.id, "half_time"), "Half time.")}>Half Time</button>}
        {(m.status === "paused" || m.status === "half_time") && <button className="btn p" disabled={busy} onClick={() => act(changeStatus(m.id, "live"), "Match resumed.")}>Resume match</button>}
        {(isLive || m.status === "paused") && <button className="btn d" disabled={busy} onClick={() => setDialog("end")}>End match</button>}
        {m.status === "full_time" && isAdmin && <button className="btn or" onClick={() => setDialog("reopen")}>Reopen match</button>}
        <button className="btn s" disabled={busy || m.status === "full_time" || pend.n > 0} onClick={() => act(undo(m.id), "Last change undone.")}>Undo last</button>
        <button className="btn s" disabled={busy || m.status === "full_time" || m.status === "upcoming"} onClick={() => setDialog("correct")}>Correct score</button>
        <button className="btn s" disabled={busy || m.status === "upcoming"} onClick={() => setDialog("event")}>Add event</button>
      </div>

      <div className="g2">
        <section className="card"><h2>Score record</h2>
          <div className="feed">
            {log.map((l) => <div key={l.id}>{l.text}{l.reason ? ` (${l.reason})` : ""}<small>{l.who}, {fmtTime(l.at)}</small></div>)}
            {log.length === 0 && <div>No updates yet.</div>}
          </div>
        </section>
        <section className="pub" aria-label="Public website preview">
          <div className="mh" style={{ color: "#BFD3EA" }}><span>Spectators see this on Live Score</span><LiveBadge lastUpdated={live.lastUpdated} stale={live.stale} className="lbadge" /></div>
          <div className="mini"><b>{a}</b><span className="num">{m.score_a} - {m.score_b}</span><b className="e">{b}</b></div>
          <Link href={`/match/${m.id}`} target="_blank">Open the public match page</Link>
        </section>
      </div>

      {dialog === "end" && <EndDialog m={m} onClose={() => setDialog(null)} onDone={(r) => { if (accept(r)) { setDialog(null); toast("Match ended. Standings are updated."); } }} />}
      {dialog === "correct" && <CorrectDialog m={m} sa={sa} sb={sb} onClose={() => setDialog(null)} onSubmit={async (x, y, reason) => { const r = await act(correct(m.id, x, y, reason), "Score corrected."); if (r.ok) setDialog(null); return r; }} />}
      {dialog === "event" && <EventDialog m={m} onClose={() => setDialog(null)} onSubmit={async (e) => { const r = await act(addMatchEvent(m.id, e), "Event added."); if (r.ok) setDialog(null); return r; }} />}
      {dialog === "reopen" && <ReasonDialog title="Reopen this match?" body="The match goes back to Paused and the result is removed until it is ended again. If the winner changes, check the later rounds in Match Mapping." cta="Reopen match" onClose={() => setDialog(null)} onSubmit={async (reason) => { const r = await act(reopen(m.id, reason), "Match reopened."); if (r.ok) setDialog(null); return r; }} />}
    </>
  );
}

function TickClock({ m, offsetMs }: { m: PublicMatch; offsetMs: number }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const first = setTimeout(() => setNow(Date.now()), 0);
    const id = m.status === "live" ? setInterval(() => setNow(Date.now()), 1000) : undefined;
    return () => { clearTimeout(first); clearInterval(id); };
  }, [m.status]);
  return <>{formatClock(now === null ? m.clock_elapsed_ms : matchClock(m, now + offsetMs))}</>;
}

/** Confirms Full Time; a drawn knockout match needs a winner and a reason. */
export function EndDialog({ m, onClose, onDone }: { m: PublicMatch; onClose: () => void; onDone: (r: MatchResult) => void }) {
  const draw = m.score_a === m.score_b && !m.group_name && m.sport.format !== "medal_only";
  const [winner, setWinner] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit() {
    setBusy(true);
    setError("");
    const r = await changeStatus(m.id, "full_time", draw ? { winner: winner || undefined, reason } : {}).catch(() => ({ ok: false as const, error: "No connection. Please try again." }));
    setBusy(false);
    if (!r.ok) setError(r.error); else onDone(r);
  }
  return (
    <Dialog title="End this match?" onClose={onClose} alert
      footer={<><button className="btn s" onClick={onClose}>Cancel</button><button className="btn d" disabled={busy} onClick={submit}>End match</button></>}>
      <p style={{ fontSize: 14.5, lineHeight: 1.5 }}>{m.team_a?.short_name} {m.score_a} - {m.score_b} {m.team_b?.short_name}. Full Time locks the score, updates Standings and moves the winner into the next round.</p>
      {draw && <>
        <p style={{ fontSize: 14.5, fontWeight: 600 }}>This knockout match is a draw. Choose who goes through, for example after penalties.</p>
        <div className="fld"><label htmlFor="end-w">Winner</label>
          <select id="end-w" className="inp" value={winner} onChange={(e) => setWinner(e.target.value)}>
            <option value="">Choose the winner</option>
            {m.team_a && <option value={m.team_a.id}>{m.team_a.short_name}</option>}
            {m.team_b && <option value={m.team_b.id}>{m.team_b.short_name}</option>}
          </select></div>
        <div className="fld"><label htmlFor="end-r">Reason</label><input id="end-r" className="inp" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="For example, won 5-4 on penalties" /></div>
      </>}
      {error && <div className="err" role="alert">{error}</div>}
    </Dialog>
  );
}

function CorrectDialog({ m, sa, sb, onClose, onSubmit }: { m: PublicMatch; sa: number; sb: number; onClose: () => void; onSubmit: (a: number, b: number, reason: string) => Promise<MatchResult> }) {
  const [x, setX] = useState(String(sa));
  const [y, setY] = useState(String(sb));
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  return (
    <Dialog title="Correct the score" onClose={onClose}
      footer={<><button className="btn s" onClick={onClose}>Cancel</button><button className="btn p" onClick={async () => { const r = await onSubmit(Number(x), Number(y), reason); if (!r.ok) setError(r.error); }}>Save correction</button></>}>
      <div className="g-f">
        <div className="fld"><label htmlFor="c-a">{m.team_a?.short_name}</label><input id="c-a" className="inp" type="number" min={0} inputMode="numeric" value={x} onChange={(e) => setX(e.target.value)} /></div>
        <div className="fld"><label htmlFor="c-b">{m.team_b?.short_name}</label><input id="c-b" className="inp" type="number" min={0} inputMode="numeric" value={y} onChange={(e) => setY(e.target.value)} /></div>
      </div>
      <div className="fld"><label htmlFor="c-r">Reason</label><input id="c-r" className="inp" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="For example, referee correction" /><small>Required. It is saved in the Audit Log with your name.</small></div>
      {error && <div className="err" role="alert">{error}</div>}
    </Dialog>
  );
}

function EventDialog({ m, onClose, onSubmit }: { m: PublicMatch; onClose: () => void; onSubmit: (e: { kind: EventKind; team: string | null; detail: string; minuteLabel: string }) => Promise<MatchResult> }) {
  const [kind, setKind] = useState<EventKind>("goal");
  const [team, setTeam] = useState(m.team_a?.id ?? "");
  const [minute, setMinute] = useState(m.clock_elapsed_ms ? `${Math.floor(m.clock_elapsed_ms / 60000) + 1}'` : "");
  const [detail, setDetail] = useState("");
  const [error, setError] = useState("");
  return (
    <Dialog title="Add a match event" onClose={onClose}
      footer={<><button className="btn s" onClick={onClose}>Cancel</button><button className="btn p" onClick={async () => { const r = await onSubmit({ kind, team: kind === "note" ? null : team || null, detail, minuteLabel: minute }); if (!r.ok) setError(r.error); }}>Add event</button></>}>
      <div className="g-f">
        <div className="fld"><label htmlFor="e-k">Type</label><select id="e-k" className="inp" value={kind} onChange={(e) => setKind(e.target.value as EventKind)}>{EVENT_KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
        <div className="fld"><label htmlFor="e-t">Team</label><select id="e-t" className="inp" value={team} disabled={kind === "note"} onChange={(e) => setTeam(e.target.value)}>
          {m.team_a && <option value={m.team_a.id}>{m.team_a.short_name}</option>}{m.team_b && <option value={m.team_b.id}>{m.team_b.short_name}</option>}
        </select></div>
      </div>
      <div className="g-f">
        <div className="fld"><label htmlFor="e-m">Minute or period</label><input id="e-m" className="inp" value={minute} maxLength={20} onChange={(e) => setMinute(e.target.value)} placeholder="58', HT, Set 2" /></div>
        <div className="fld"><label htmlFor="e-d">Detail</label><input id="e-d" className="inp" value={detail} maxLength={200} onChange={(e) => setDetail(e.target.value)} placeholder="Player and number" /></div>
      </div>
      {error && <div className="err" role="alert">{error}</div>}
    </Dialog>
  );
}

export function ReasonDialog({ title, body, cta, onClose, onSubmit }: { title: string; body: string; cta: string; onClose: () => void; onSubmit: (reason: string) => Promise<{ ok: boolean; error?: string }> }) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  return (
    <Dialog title={title} onClose={onClose} alert
      footer={<><button className="btn s" onClick={onClose}>Cancel</button><button className="btn d" onClick={async () => { const r = await onSubmit(reason); if (!r.ok) setError(r.error ?? "Something went wrong."); }}>{cta}</button></>}>
      <p style={{ fontSize: 14.5, lineHeight: 1.5 }}>{body}</p>
      <div className="fld"><label htmlFor="rs">Reason</label><input id="rs" className="inp" value={reason} onChange={(e) => setReason(e.target.value)} /></div>
      {error && <div className="err" role="alert">{error}</div>}
    </Dialog>
  );
}
