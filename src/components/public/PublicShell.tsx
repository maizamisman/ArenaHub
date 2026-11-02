"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import { dict, fmtDay, fmtTime, LANG_COOKIE, type Lang } from "@/i18n";
import type { Announcement } from "@/data/public";
import { useLiveData } from "./LiveContext";

type Modules = { photos: boolean; announcements: boolean; standings: boolean; venue_map: boolean };
type ShellCtx = { go: (href: string, label?: string) => void; toast: (msg: string) => void; modules: Modules; still: boolean };
const Shell = createContext<ShellCtx | null>(null);
export const useShell = () => useContext(Shell)!;

const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));

export function PublicShell({ lang, modules, announcements, eventName, organiser, children }: {
  lang: Lang; modules: Modules; announcements: Announcement[]; eventName: string; organiser: string; children: React.ReactNode;
}) {
  const t = dict(lang);
  const router = useRouter();
  const path = usePathname();
  const { snapshot } = useLiveData();
  const [menu, setMenu] = useState(false);
  const [ann, setAnn] = useState(false);
  const [wipe, setWipe] = useState<"" | "in" | "out">("");
  const [wipeLabel, setWipeLabel] = useState("");
  const [toastMsg, setToastMsg] = useState("");
  const [loader, setLoader] = useState(false);
  const still = useReducedMotion();
  const pending = useRef<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const liveCount = snapshot.matches.filter((m) => m.status === "live").length;
  const nav = [
    { href: "/", l: t.home, on: path === "/" },
    { href: "/live", l: t.live, on: path.startsWith("/live") || path.startsWith("/match"), count: liveCount },
    ...(modules.standings ? [{ href: "/standings", l: t.standings, on: path.startsWith("/standings") }] : []),
    { href: "/schedule", l: t.schedule, on: path.startsWith("/schedule") || path.startsWith("/venues") },
    ...(modules.photos ? [{ href: "/photos", l: t.photos, on: path.startsWith("/photos") }] : []),
  ];

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    // The intro loader plays once per visit, on the home page only.
    try {
      if (path === "/" && !mq.matches && !sessionStorage.getItem("ah_intro")) {
        sessionStorage.setItem("ah_intro", "1");
        const on = setTimeout(() => setLoader(true), 0);
        const off = setTimeout(() => setLoader(false), 2200);
        return () => { clearTimeout(on); clearTimeout(off); };
      }
    } catch { /* storage blocked */ }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Finish the page wipe once the new page is on screen.
  useEffect(() => {
    if (pending.current && pending.current.split("?")[0] === path) {
      pending.current = null;
      window.scrollTo(0, 0);
      setWipe("out");
      const id = setTimeout(() => setWipe(""), 600);
      return () => clearTimeout(id);
    }
  }, [path]);

  const go = useCallback((href: string, label?: string) => {
    setMenu(false);
    setAnn(false);
    if (still || href.split("?")[0] === path) { router.push(href); window.scrollTo(0, 0); return; }
    setWipeLabel(label ?? "Arena Hub");
    setWipe("in");
    pending.current = href;
    setTimeout(() => router.push(href), 470);
  }, [path, router, still]);

  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(""), 3200);
  }, []);

  function setLang(l: Lang) {
    document.cookie = `${LANG_COOKIE}=${l}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  }

  // Reveal-on-scroll for .rv/.rx/.rc, including elements that appear later.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const io = "IntersectionObserver" in window
      ? new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("seen"); io?.unobserve(e.target); } }), { rootMargin: "0px 0px -6% 0px" })
      : null;
    const scan = () => root.querySelectorAll(".rv:not(.seen),.rx:not(.seen),.rc:not(.seen)").forEach((n) => (io ? io.observe(n) : n.classList.add("seen")));
    scan();
    const mo = new MutationObserver(scan);
    mo.observe(root, { childList: true, subtree: true });
    return () => { io?.disconnect(); mo.disconnect(); };
  }, []);

  // Scroll-linked effects: solid nav, scrubbed text, hero parallax, photo wall columns, track rings.
  useEffect(() => {
    let dirty = true;
    let raf = 0;
    const frame = () => {
      const root = rootRef.current;
      if (!root) return;
      const vh = window.innerHeight;
      root.querySelector("[data-nav]")?.classList.toggle("scrolled", window.scrollY > 30);
      root.querySelectorAll<HTMLElement>("[data-scrub]").forEach((n) => {
        const b = n.getBoundingClientRect();
        n.style.setProperty("--pr", clamp((vh * 0.82 - b.top) / Math.max(b.height, 1), 0, 1).toFixed(3));
      });
      if (still) return;
      const hero = root.querySelector<HTMLElement>("[data-hero]");
      if (hero) {
        const b = hero.getBoundingClientRect();
        const p = clamp(-b.top / b.height, 0, 1);
        const hm = hero.querySelector<HTMLElement>("[data-hm]"), ho = hero.querySelector<HTMLElement>("[data-ho]"), hc = hero.querySelector<HTMLElement>("[data-hc]");
        if (hm) hm.style.transform = `translate3d(0,${(p * 30).toFixed(2)}%,0)`;
        if (ho) ho.style.opacity = p.toFixed(3);
        if (hc) { hc.style.transform = `translate3d(0,${(p * -90).toFixed(1)}px,0)`; hc.style.opacity = (1 - p * 1.3).toFixed(3); }
      }
      root.querySelectorAll<HTMLElement>("[data-pxw]").forEach((w) => {
        const b = w.getBoundingClientRect();
        const off = clamp(b.top + b.height / 2 - vh / 2, -1400, 1400);
        w.querySelectorAll<HTMLElement>("[data-px]").forEach((n) => { n.style.transform = `translate3d(0,${(off * Number(n.dataset.px)).toFixed(1)}px,0)`; });
      });
      root.querySelectorAll<HTMLElement>("[data-rot]").forEach((n) => { n.style.transform = `rotate(${(window.scrollY * -0.09).toFixed(2)}deg)`; });
    };
    const loop = () => { raf = requestAnimationFrame(loop); if (dirty) { dirty = false; frame(); } };
    const mark = () => { dirty = true; };
    raf = requestAnimationFrame(loop);
    window.addEventListener("scroll", mark, { passive: true });
    window.addEventListener("resize", mark);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("scroll", mark); window.removeEventListener("resize", mark); };
  }, [still, path]);

  useEffect(() => {
    if (!menu && !ann) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setMenu(false); setAnn(false); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menu, ann]);

  return (
    <Shell.Provider value={{ go, toast, modules, still }}>
      <div ref={rootRef} className="site">
        {loader && <div className="loader" aria-hidden="true"><div className="lw">Arena<em>Hub</em></div></div>}
        <div className={`wipe ${wipe}`} aria-hidden="true"><b>{wipeLabel}</b></div>
        <a href="#main" className="sr-only">Skip to content</a>

        <header className={`nav${path === "/" ? "" : " solid"}`} data-nav>
          <div className="nav-in">
            <Link href="/" className="brand" aria-label={`Arena Hub, ${t.home}`} onClick={(e) => { e.preventDefault(); go("/", "Arena Hub"); }}>
              <span className="fl"><img src="/flags/flag-a.svg" alt="" /><img src="/flags/flag-h.svg" alt="" /></span>
              <b>Arena<em>Hub</em></b>
            </Link>
            <nav className="links" aria-label="Main">
              {nav.map((n) => (
                <Link key={n.href} href={n.href} className={`nl${n.on ? " on" : ""}`} aria-current={n.on ? "page" : undefined}
                  onClick={(e) => { e.preventDefault(); go(n.href, n.l); }}>
                  <span className="roll" data-t={n.l}><span>{n.l}</span></span>{n.count ? <em>{n.count}</em> : null}
                </Link>
              ))}
            </nav>
            <div className="tools">
              <div className="lang" role="group" aria-label={t.langLabel}>
                <button className={lang === "en" ? "on" : ""} aria-pressed={lang === "en"} onClick={() => setLang("en")}>EN</button>
                <button className={lang === "bm" ? "on" : ""} aria-pressed={lang === "bm"} onClick={() => setLang("bm")}>BM</button>
              </div>
              {modules.announcements && (
                <button className="ic" onClick={() => setAnn((x) => !x)} aria-label={t.announcements} aria-expanded={ann}>
                  <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 11v2a1 1 0 0 0 1 1h3l9 5V5L7 10H4a1 1 0 0 0-1 1Z" /><path d="M20 9a4 4 0 0 1 0 6" /></svg>
                  {announcements.length > 0 && <i>{announcements.length}</i>}
                </button>
              )}
              <button className={`burger${menu ? " on" : ""}`} onClick={() => setMenu((x) => !x)} aria-label={t.menu} aria-expanded={menu} aria-controls="ah-menu">
                <span /><span /><span />
              </button>
            </div>
          </div>
        </header>

        <div id="ah-menu" className={`ov${menu ? " on" : ""}`} aria-hidden={!menu}>
          {nav.map((n, i) => (
            <Link key={n.href} href={n.href} className={`ol${n.on ? " on" : ""}`} style={{ "--i": i } as React.CSSProperties} tabIndex={menu ? 0 : -1}
              onClick={(e) => { e.preventDefault(); go(n.href, n.l); }}>
              <span>{n.l}{n.count ? <em>{n.count}</em> : null}</span>
            </Link>
          ))}
        </div>

        {ann && modules.announcements && (
          <aside className="pop" aria-label={t.announcements}>
            <div className="pop-h"><b>{t.announcements}</b>
              <button className="x" onClick={() => setAnn(false)} aria-label={t.close}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg></button>
            </div>
            {announcements.length === 0 && <div className="an"><p>{t.noAnnouncements}</p></div>}
            {announcements.map((a) => (
              <article className="an" key={a.id}><b>{a.title}</b><p>{a.body}</p><small>{fmtDay(a.updated_at, lang)}, {fmtTime(a.updated_at)}</small></article>
            ))}
          </aside>
        )}
        {toastMsg && <div className="toast" role="status">{toastMsg}</div>}

        <main id="main">{children}</main>

        <footer className="foot"><div className="wrap">
          <div><b>Arena Hub</b>, {eventName}. {t.organised(organiser)}</div>
          <div style={{ display: "flex", gap: 18, flexWrap: "wrap", alignItems: "center" }}>
            {modules.venue_map && <Link className="lnk" href="/venues">{t.venues}</Link>}
            <Link className="lnk" href="/staff/login">{t.staff}</Link>
          </div>
        </div></footer>
      </div>
    </Shell.Provider>
  );
}

const RM = "(prefers-reduced-motion: reduce)";
function useReducedMotion(): boolean {
  return useSyncExternalStore(
    (cb) => { const mq = window.matchMedia(RM); mq.addEventListener("change", cb); return () => mq.removeEventListener("change", cb); },
    () => window.matchMedia(RM).matches,
    () => false,
  );
}

/** A link that plays the page wipe. */
export function GoLink({ href, label, className, children, ...rest }: { href: string; label?: string; className?: string; children: React.ReactNode } & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href">) {
  const { go } = useShell();
  return <Link href={href} className={className} {...rest} onClick={(e) => { if (e.metaKey || e.ctrlKey || e.shiftKey) return; e.preventDefault(); go(href, label); }}>{children}</Link>;
}

/** Page title with the letter-by-letter reveal; screen readers get the plain text. */
export function RevealTitle({ text }: { text: string }) {
  let i = 0;
  return (
    <h1 className="d ttl" aria-label={text}>
      {text.split(" ").map((w, wi) => (
        <span className="tw" aria-hidden="true" key={wi}>
          {w.split("").map((c, ci) => <span className="c" style={{ "--i": i++ } as React.CSSProperties} key={ci}>{c}</span>)}
        </span>
      ))}
    </h1>
  );
}

export function NotAvailable({ lang }: { lang: Lang }) {
  const t = dict(lang);
  return (
    <section className="na">
      <h1 className="d">{t.unavailable}</h1>
      <p>{t.unavailableSub}</p>
      <GoLink className="btn b-s" href="/">{t.backHome}</GoLink>
    </section>
  );
}
