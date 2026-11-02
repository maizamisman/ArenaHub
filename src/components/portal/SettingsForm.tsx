"use client";

/* eslint-disable @next/next/no-img-element */
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Settings } from "@/data/settings";
import { saveSettingsAction, uploadLogoAction } from "@/app/staff/actions/admin";
import { useToast } from "./PortalShell";

const SECTION = { live: "Live Score", standings: "Standings", schedule: "Schedule", photos: "Photo Share" } as const;
const MODULE = { photos: "Photo Share", announcements: "Announcements", standings: "Standings", venue_map: "Venue map and directions" } as const;

export function SettingsForm({ settings, matches }: { settings: Settings; matches: { id: string; label: string }[] }) {
  const router = useRouter();
  const toast = useToast();
  const [s, setS] = useState(settings);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function save(patch: Partial<Settings>) {
    setBusy(true);
    const r = await saveSettingsAction(patch);
    setBusy(false);
    if (!r.ok) { setError(r.error); toast(r.error, false); return; }
    setError("");
    toast(r.message ?? "Saved.");
    router.refresh();
  }
  const move = (i: number, d: -1 | 1) => {
    const list = [...s.home_sections];
    const j = i + d;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    setS({ ...s, home_sections: list });
  };
  const toggleSection = (k: string) => setS({ ...s, home_sections: s.home_sections.includes(k) ? s.home_sections.filter((x) => x !== k) : [...s.home_sections, k] });

  return (
    <>
      {error && <div className="err" role="alert">{error}</div>}
      <section className="card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <h2>Event</h2>
        <div className="g-f">
          <div className="fld"><label htmlFor="s-n">Event name</label><input id="s-n" className="inp" value={s.event_name} onChange={(e) => setS({ ...s, event_name: e.target.value })} /></div>
          <div className="fld"><label htmlFor="s-o">Organiser</label><input id="s-o" className="inp" value={s.organiser} onChange={(e) => setS({ ...s, organiser: e.target.value })} /></div>
          <div className="fld"><label htmlFor="s-t">Tagline (English)</label><input id="s-t" className="inp" value={s.tagline} onChange={(e) => setS({ ...s, tagline: e.target.value })} /></div>
          <div className="fld"><label htmlFor="s-tb">Tagline (Bahasa Melayu)</label><input id="s-tb" className="inp" value={s.tagline_bm} onChange={(e) => setS({ ...s, tagline_bm: e.target.value })} /></div>
          <div className="fld"><label htmlFor="s-c">Theme colour</label>
            <div style={{ display: "flex", gap: 8 }}><input id="s-c" className="inp" value={s.theme_colour} onChange={(e) => setS({ ...s, theme_colour: e.target.value })} /><input type="color" aria-label="Pick theme colour" value={/^#[0-9a-f]{6}$/i.test(s.theme_colour) ? s.theme_colour : "#1F4FE0"} onChange={(e) => setS({ ...s, theme_colour: e.target.value.toUpperCase() })} style={{ width: 54, height: 44, border: 0, background: "none" }} /></div>
            <small>Used for the Live Score stage and buttons on the public website.</small></div>
          <div className="fld"><label htmlFor="s-f">Featured match on Live Score</label>
            <select id="s-f" className="inp" value={s.featured_match_id ?? ""} onChange={(e) => setS({ ...s, featured_match_id: e.target.value || null })}>
              <option value="">First live match</option>{matches.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select></div>
        </div>
        <div><button className="btn p" disabled={busy} onClick={() => save({ event_name: s.event_name, organiser: s.organiser, tagline: s.tagline, tagline_bm: s.tagline_bm, theme_colour: s.theme_colour, featured_match_id: s.featured_match_id })}>Save event details</button></div>
      </section>

      <section className="card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <h2>Logo</h2>
        {s.logo_path ? <img src={s.logo_path} alt="Current logo" style={{ maxHeight: 64, maxWidth: 240, objectFit: "contain", alignSelf: "flex-start" }} /> : <p style={{ fontSize: 14, color: "var(--mute)" }}>No logo uploaded. The ArenaHub flags are shown.</p>}
        <form action={async (fd) => { const r = await uploadLogoAction(fd); if (!r.ok) toast(r.error, false); else { toast(r.message ?? "Saved."); router.refresh(); } }} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <label className="lab" htmlFor="s-logo">Logo image (JPG, PNG or WebP, up to 2 MB)</label>
          <input id="s-logo" name="logo" type="file" accept="image/jpeg,image/png,image/webp" required />
          <button className="btn s" type="submit">Upload logo</button>
        </form>
      </section>

      <section className="card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <h2>Website sections</h2>
        <p style={{ fontSize: 14, color: "var(--mute)" }}>Switched-off sections disappear from the navigation, and their pages say “Not available right now”.</p>
        {(Object.keys(MODULE) as (keyof typeof MODULE)[]).map((k) => (
          <label className="ck" key={k}><input type="checkbox" checked={s.modules[k]} onChange={(e) => setS({ ...s, modules: { ...s.modules, [k]: e.target.checked } })} />{MODULE[k]}</label>
        ))}
        <div className="fld" style={{ maxWidth: 420 }}><label htmlFor="s-pa">New photos</label>
          <select id="s-pa" className="inp" value={s.photo_approval} onChange={(e) => setS({ ...s, photo_approval: e.target.value as Settings["photo_approval"] })}>
            <option value="instant">Go on the wall at once (staff can delete)</option><option value="approval">Wait for a PIC or the Admin to approve</option>
          </select></div>
        <div><button className="btn p" disabled={busy} onClick={() => save({ modules: s.modules, photo_approval: s.photo_approval })}>Save sections</button></div>
      </section>

      <section className="card" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <h2>Home page links</h2>
        <p style={{ fontSize: 14, color: "var(--mute)" }}>The big section links under the hero, in this order.</p>
        {(Object.keys(SECTION) as (keyof typeof SECTION)[]).sort((a, b) => (s.home_sections.indexOf(a) + 99 * +!s.home_sections.includes(a)) - (s.home_sections.indexOf(b) + 99 * +!s.home_sections.includes(b))).map((k) => {
          const i = s.home_sections.indexOf(k);
          return (
            <div key={k} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <label className="ck" style={{ flex: "1 1 200px" }}><input type="checkbox" checked={i >= 0} onChange={() => toggleSection(k)} />{SECTION[k]}</label>
              <button className="btn s sm" disabled={i <= 0} onClick={() => move(i, -1)} aria-label={`Move ${SECTION[k]} up`}>Up</button>
              <button className="btn s sm" disabled={i < 0 || i === s.home_sections.length - 1} onClick={() => move(i, 1)} aria-label={`Move ${SECTION[k]} down`}>Down</button>
            </div>
          );
        })}
        <div><button className="btn p" disabled={busy} onClick={() => save({ home_sections: s.home_sections })}>Save home page</button></div>
      </section>
    </>
  );
}
