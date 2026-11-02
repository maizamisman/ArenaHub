"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { PublicPhoto } from "@/data/photos";
import { dict, fmtDay, fmtTime, type Lang } from "@/i18n";
import { compressImage } from "@/lib/compress";
import { RevealTitle, useShell } from "./PublicShell";

const X = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>;
const HEART = <svg width="16" height="16" viewBox="0 0 24 24" strokeWidth="2.2" strokeLinejoin="round" aria-hidden="true"><path d="M20.8 5.6a5.5 5.5 0 0 0-7.8 0L12 6.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 22l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z" /></svg>;

export function PhotosClient({ lang, photos, approval }: { lang: Lang; photos: PublicPhoto[]; approval: boolean }) {
  const t = dict(lang);
  const router = useRouter();
  const { toast, still } = useShell();
  const [sort, setSort] = useState<"new" | "loved">("new");
  const [likes, setLikes] = useState<Record<string, { n: number; on: boolean }>>({});
  const [view, setView] = useState<number | null>(null);
  const [share, setShare] = useState(false);
  const [cols, setCols] = useState(3);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 759px)");
    const on = () => setCols(mq.matches ? 2 : 3);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  const like = (p: PublicPhoto) => likes[p.id] ?? { n: p.likes, on: p.liked };
  const list = useMemo(() => {
    const l = [...photos];
    if (sort === "loved") l.sort((a, b) => (likes[b.id]?.n ?? b.likes) - (likes[a.id]?.n ?? a.likes));
    return l;
  }, [photos, sort, likes]);
  const columns = Array.from({ length: cols }, (_, c) => list.map((p, i) => ({ p, i })).filter((x) => x.i % cols === c));

  async function toggleLike(p: PublicPhoto) {
    const cur = like(p);
    setLikes((s) => ({ ...s, [p.id]: { n: cur.n + (cur.on ? -1 : 1), on: !cur.on } }));
    const r = await fetch(`/api/photos/${p.id}/like`, { method: cur.on ? "DELETE" : "POST" }).catch(() => null);
    if (r?.ok) { const j = await r.json(); setLikes((s) => ({ ...s, [p.id]: { n: j.likes, on: j.liked } })); }
    else setLikes((s) => ({ ...s, [p.id]: cur }));
  }

  async function report(p: PublicPhoto) {
    if (!window.confirm(t.reportConfirm)) return;
    await fetch(`/api/photos/${p.id}/report`, { method: "POST" }).catch(() => null);
    toast(t.reported);
  }

  const cur = view !== null ? list[view] : null;
  const stamp = (p: PublicPhoto) => `${fmtDay(p.created_at, lang)}, ${fmtTime(p.created_at)}`;

  return (
    <div className="s-ph">
      <section className="ph long">
        <RevealTitle text={t.photos} />
        <div className="pcta"><p style={{ margin: 0 }}>{t.photoSub}</p>
          <button className="btn b-s" onClick={() => setShare(true)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>{t.share}
          </button>
        </div>
      </section>
      <p className="note">{approval ? t.photoNoteApproval : t.photoNote}</p>
      <div className="pbar">
        <div className="bar" style={{ margin: 0, padding: 0 }}>
          {([["new", t.newest], ["loved", t.loved]] as const).map(([k, l]) => <button key={k} className={`chip${sort === k ? " on" : ""}`} aria-pressed={sort === k} onClick={() => setSort(k)}>{l}</button>)}
        </div>
        <span style={{ fontSize: 14.5, color: "#C4D5EF" }}>{t.photoN(list.length)}</span>
      </div>
      {list.length === 0 && <div className="empty">{t.noPhotos}</div>}
      <div className="wall" data-pxw={still ? undefined : ""} data-testid="photo-wall">
        {columns.map((col, c) => (
          <div className="pcol" key={c} data-px={[0.04, -0.06, 0.08][c % 3]}>
            {col.map(({ p, i }) => {
              const l = like(p);
              return (
                <article className="pic" key={p.id}>
                  <div className="rc"><button className="pbtn" onClick={() => setView(i)}>
                    <img src={p.src} alt={`${t.viewPhoto}: ${p.caption || stamp(p)}`} loading="lazy" />{p.by_admin && <span className="by">{t.byAdmin}</span>}
                  </button></div>
                  <div className="pb">{p.caption && <b>{p.caption}</b>}
                    <div className="pf"><span>{stamp(p)}{!p.by_admin && !p.mine && <button className="rep" onClick={() => report(p)}>{t.report}</button>}</span>
                      <button className={`like${l.on ? " on" : ""}`} onClick={() => toggleLike(p)} aria-pressed={l.on} aria-label={`${t.love}, ${l.n}`}>{HEART}{l.n}</button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ))}
      </div>

      {cur && (
        <div className="scrim" onClick={(e) => { if (e.target === e.currentTarget) setView(null); }}>
          <div className="lb" role="dialog" aria-modal="true" aria-label={cur.caption || t.photos}>
            <img src={cur.src} alt={cur.caption || t.photos} />
            <button className="x" onClick={() => setView(null)} aria-label={t.close} autoFocus>{X}</button>
            <div className="lb-b"><div><div className="t">{cur.caption || t.photos}</div><div className="s">{stamp(cur)}</div></div>
              <div className="lb-n">
                <button className={`mini${like(cur).on ? " on" : ""}`} onClick={() => toggleLike(cur)} aria-pressed={like(cur).on}><svg className="h" width="17" height="17" viewBox="0 0 24 24" strokeWidth="2.2" strokeLinejoin="round" aria-hidden="true"><path d="M20.8 5.6a5.5 5.5 0 0 0-7.8 0L12 6.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 22l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z" /></svg>{like(cur).n}</button>
                <button className="mini" onClick={() => setView((view! + list.length - 1) % list.length)}>{t.prev}</button>
                <button className="mini" onClick={() => setView((view! + 1) % list.length)}>{t.next}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {share && <ShareDialog lang={lang} onClose={() => setShare(false)} onPosted={(status) => {
        setShare(false);
        toast(status === "live" ? t.posted : t.postedPending);
        router.refresh();
      }} />}
    </div>
  );
}

function ShareDialog({ lang, onClose, onPosted }: { lang: Lang; onClose: () => void; onPosted: (status: "live" | "pending") => void }) {
  const t = dict(lang);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [caption, setCaption] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  function pickFile(f: File | undefined) {
    setError("");
    if (!f) return;
    if (!f.type.startsWith("image/")) { setError(t.fileHint); return; }
    if (f.size > 10 * 1024 * 1024) { setError(t.fileHint); return; }
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  async function post() {
    if (!file || !consent) return;
    setError("");
    setBusy(t.preparing);
    try {
      const blob = await compressImage(file);
      setBusy(t.posting);
      const fd = new FormData();
      fd.append("file", blob, "photo.jpg");
      fd.append("caption", caption);
      fd.append("consent", "yes");
      const r = await fetch("/api/photos", { method: "POST", body: fd });
      const j = await r.json().catch(() => ({ ok: false, error: "Something went wrong. Please try again." }));
      if (!j.ok) { setError(j.error); return; }
      onPosted(j.status);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="scrim" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={t.share}>
        <div className="mh"><h2 className="d">{t.share}</h2><button ref={closeRef} className="x" onClick={onClose} aria-label={t.close}>{X}</button></div>
        {!file ? (
          <div className="drop"><b>{t.addPhoto}</b><span>{t.fileHint}</span>
            <label className="btn b-n" style={{ cursor: "pointer" }}>{t.choose}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => pickFile(e.target.files?.[0])} data-testid="photo-input" /></label>
          </div>
        ) : (
          <div><img className="prev" src={preview} alt={t.preview} /><button className="lnk" onClick={() => { setFile(null); setPreview(""); }}>{t.removePhoto}</button></div>
        )}
        <div className="fld"><label htmlFor="ah-msg">{t.desc} <span>({t.optional})</span></label>
          <textarea id="ah-msg" value={caption} maxLength={200} onChange={(e) => setCaption(e.target.value)} placeholder={t.descPh} /></div>
        <p style={{ fontSize: 14, lineHeight: 1.5, color: "#2F3F54" }}>{t.shareNote}</p>
        <label className="consent"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} /><span>{t.consent}</span></label>
        {error && <div className="ferr" role="alert">{error}</div>}
        <button className="btn b-n" onClick={post} disabled={!file || !consent || !!busy}>{busy || t.post}</button>
      </div>
    </div>
  );
}
