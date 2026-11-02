"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { logoutAction } from "@/app/staff/actions/auth";
import { Brand } from "./Brand";

const IC: Record<string, string> = {
  dash: "M4 4h7v7H4zM13 4h7v4h-7zM13 11h7v9h-7zM4 14h7v6H4z",
  sports: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM3.5 9.5C8 11 16 11 20.5 9.5M3.5 14.5C8 13 16 13 20.5 14.5",
  teams: "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM2 21c0-4 3-6 7-6s7 2 7 6M16 3.5a4 4 0 0 1 0 7M18 15c2.5.5 4 2.5 4 6",
  courts: "M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21ZM12 7a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Z",
  matches: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4",
  map: "M4 5h5v5H4zM4 14h5v5H4zM15 9.5h5v5h-5zM9 7.5h3v9H9M12 12h3",
  medals: "M8 3h8l-2 6h-4ZM12 9a6 6 0 1 0 0 12 6 6 0 0 0 0-12Z",
  pics: "M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21c0-4 3.5-6 8-6s8 2 8 6",
  monitor: "M3 12h4l3-7 4 14 3-7h4",
  photos: "M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M15 9h.01",
  anns: "M3 11v2a1 1 0 0 0 1 1h3l9 5V5L7 10H4a1 1 0 0 0-1 1ZM20 9a4 4 0 0 1 0 6",
  settings: "M4 7h9M17 7h3M4 17h3M11 17h9M15 5v4M9 15v4",
  audit: "M6 3h9l4 4v14H6zM14 3v5h5M9 12h7M9 16h7",
  backup: "M12 3v12M7 10l5 5 5-5M4 19h16",
  score: "M12 5v14M5 12h14",
  status: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM10 8.5v7l5-3.5Z",
  history: "M4 12a8 8 0 1 0 2.5-5.8L4 8.5M4 4v4.5h4.5M12 8v4l3 2",
  mine: "M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01",
};

export const NAV: Record<"admin" | "pic", [string, string, string][]> = {
  admin: [
    ["/staff/admin", "Dashboard", "dash"], ["/staff/admin/sports", "Sports", "sports"], ["/staff/admin/teams", "Teams", "teams"],
    ["/staff/admin/courts", "Courts", "courts"], ["/staff/admin/matches", "Matches", "matches"], ["/staff/admin/map", "Match Mapping", "map"],
    ["/staff/admin/medals", "Medal Results", "medals"], ["/staff/admin/pics", "PIC Accounts", "pics"], ["/staff/admin/monitor", "Live Monitoring", "monitor"],
    ["/staff/admin/photos", "Photo Share", "photos"], ["/staff/admin/announcements", "Announcements", "anns"], ["/staff/admin/settings", "Screen Configuration", "settings"],
    ["/staff/admin/audit", "Audit Log", "audit"], ["/staff/admin/backup", "Backup", "backup"],
  ],
  pic: [
    ["/staff/pic", "Dashboard", "dash"], ["/staff/pic/matches", "My Matches", "mine"], ["/staff/pic/status", "Match Status", "status"],
    ["/staff/pic/map", "Match Mapping", "map"], ["/staff/pic/history", "Match History", "history"], ["/staff/pic/photos", "Photo Share", "photos"],
  ],
};

type Toast = { msg: string; ok: boolean } | null;
const ToastCtx = createContext<(msg: string, ok?: boolean) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function Icon({ name, size = 20 }: { name: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={IC[name]} /></svg>;
}

export function PortalShell({ role, name, children }: { role: "admin" | "pic"; name: string; children: React.ReactNode }) {
  const path = usePathname();
  const [wide, setWide] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [toast, setToast] = useState<Toast>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const nav = NAV[role];
  const roleName = role === "admin" ? "Admin Portal" : "PIC Portal";
  // The longest matching prefix is the current page.
  // The role's home (first item) only matches itself.
  const current = nav.filter(([href], i) => path === href || (i > 0 && path.startsWith(`${href}/`))).sort((a, b) => b[0].length - a[0].length)[0];
  const pageName = current?.[1] ?? (path.includes("/score/") ? "Live Score Control" : "");
  const initials = name.split(" ").map((w) => w[0]).slice(0, 2).join("");

  const show = useCallback((msg: string, ok = true) => {
    setToast({ msg, ok });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 3200);
  }, []);

  useEffect(() => {
    if (!drawer) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setDrawer(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawer]);

  const links = (onClick?: () => void) => nav.map(([href, label, ic]) => {
    const on = current?.[0] === href;
    return (
      <Link key={href} href={href} className={`nv${on ? " on" : ""}`} aria-current={on ? "page" : undefined} aria-label={label} onClick={onClick}>
        <Icon name={ic} /><span>{label}</span>
      </Link>
    );
  });

  return (
    <ToastCtx.Provider value={show}>
      <div className="shell">
        <aside className={`side${wide ? " wide" : ""}`}><div className="side-in">
          <Brand flags={1} />
          <div className="role">{roleName}</div>
          <nav aria-label={roleName} style={{ display: "flex", flexDirection: "column", gap: 2 }}>{links()}</nav>
        </div></aside>

        <div className="main">
          <header className="top">
            <button className="ib rail" onClick={() => setWide((x) => !x)} aria-label="Toggle navigation" aria-expanded={wide}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
            </button>
            <button className="ib burger" onClick={() => setDrawer(true)} aria-label="Open menu" aria-expanded={drawer}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
            </button>
            <div className="crumb">{roleName} / <b>{pageName}</b></div>
            <div className="who">
              <span className="wn">{name}</span><span className="av" aria-hidden="true">{initials}</span>
              <form action={logoutAction}><button className="btn s sm" type="submit">Sign out</button></form>
            </div>
          </header>
          <main className="pg" id="main">{children}</main>
        </div>
      </div>

      {drawer && (
        <div className="dr" onClick={(e) => { if (e.target === e.currentTarget) setDrawer(false); }}>
          <div className="dr-in" role="dialog" aria-modal="true" aria-label="Menu">
            <div className="dr-h"><Brand flags={1} />
              <button className="ib" onClick={() => setDrawer(false)} aria-label="Close menu" autoFocus>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
              </button>
            </div>
            <div className="role">{roleName}</div>
            <nav aria-label={`${roleName} menu`} style={{ display: "flex", flexDirection: "column", gap: 3 }}>{links(() => setDrawer(false))}</nav>
          </div>
        </div>
      )}
      {toast && <div className={`toast ${toast.ok ? "ok" : "bad"}`} role="status">{toast.msg}</div>}
    </ToastCtx.Provider>
  );
}

/** Modal dialog in portal style: Escape and the backdrop close it. */
export function Dialog({ title, onClose, children, footer, alert }: {
  title: string; onClose: () => void; children: React.ReactNode; footer: React.ReactNode; alert?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="scr" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="md" role={alert ? "alertdialog" : "dialog"} aria-modal="true" aria-label={title}>
        <h2>{title}</h2>
        {children}
        <div className="mfoot">{footer}</div>
      </div>
    </div>
  );
}

const STATUS_LABEL: Record<string, string> = { upcoming: "Upcoming", live: "Live", paused: "Paused", half_time: "Half Time", full_time: "Full Time" };
export const statusLabel = (s: string) => STATUS_LABEL[s] ?? s;

export function StatusPill({ status, testId }: { status: string; testId?: string }) {
  return <span className={`pill st-${status}`}>{status === "live" && <i className="dot" />}<span data-testid={testId}>{statusLabel(status)}</span></span>;
}
