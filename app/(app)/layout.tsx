"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Icon from "@/app/components/Icon";
import { MeContext, type Me } from "@/app/components/MeContext";
import { api, useApi } from "@/lib/client";

const NAV = [
  { href: "/", label: "Today", icon: "today" },
  { href: "/history", label: "History", icon: "history" },
  { href: "/progress", label: "Progress", icon: "progress" },
  { href: "/routines", label: "Routines", icon: "routines" },
  { href: "/builder", label: "Builder", icon: "builder" },
  { href: "/exercises", label: "Exercises", icon: "exercises" },
  { href: "/body", label: "Body", icon: "body" },
  { href: "/settings", label: "Settings", icon: "settings" },
];

const TABS = [
  { href: "/", label: "Today", icon: "today" },
  { href: "/history", label: "History", icon: "history" },
  { href: "__workout", label: "Workout", icon: "dumbbell" },
  { href: "/progress", label: "Progress", icon: "progress" },
];

function isActive(path: string, href: string) {
  return href === "/" ? path === "/" : path === href || path.startsWith(href + "/");
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { data: me, reload } = useApi<Me>("/api/me");
  const { data: active, reload: reloadActive } = useApi<{ session: { id: number; name: string } | null }>("/api/sessions/active");

  useEffect(() => { setOpen(false); reloadActive(); }, [path, reloadActive]);

  async function logout() {
    await api("/api/logout", { method: "POST" });
    // Full navigation so the router drops its cached signed-in pages.
    window.location.replace("/login");
  }

  async function goWorkout() {
    if (active?.session) return router.push(`/session/${active.session.id}`);
    const s = await api<{ id: number }>("/api/sessions", { body: {} });
    router.push(`/session/${s.id}`);
  }

  if (!me) return <div className="loading" style={{ minHeight: "100vh" }}>Loading…</div>;

  const inSession = path.startsWith("/session/");
  const nav = me.isAdmin ? [...NAV, { href: "/admin", label: "Admin", icon: "admin" }] : NAV;

  return (
    <MeContext.Provider value={{ me, reloadMe: reload }}>
      <div className="dashboard-root">
        <header className="dash-mobile-bar">
          <button className="dash-hamburger" onClick={() => setOpen(true)} aria-label="Menu">
            <span /><span /><span />
          </button>
          <span className="dash-mobile-title">AstroFit</span>
        </header>

        {open && <div className="dash-backdrop" onClick={() => setOpen(false)} />}

        <aside className={`sidebar ${open ? "sidebar-open" : ""}`}>
          <div className="sidebar-logo-wrap">
            <span className="sidebar-logo">AstroFit</span>
            <button className="sidebar-close" onClick={() => setOpen(false)} aria-label="Close">✕</button>
          </div>
          <nav className="sidebar-nav">
            <button className="sidebar-start" onClick={goWorkout}>
              <Icon name={active?.session ? "play" : "plus"} />
              {active?.session ? "Resume workout" : "Start workout"}
            </button>
            {nav.map(n => (
              <Link key={n.href} href={n.href} className={`sidebar-item ${isActive(path, n.href) ? "active" : ""}`}>
                <Icon name={n.icon} />
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="sidebar-footer">
            <div className="sidebar-user">{me.username}</div>
            <button className="sidebar-item" onClick={logout}><Icon name="logout" />Sign out</button>
          </div>
        </aside>

        <main className={`dashboard-main ${inSession ? "" : "has-tabbar"}`}>
          {active?.session && !inSession && (
            <Link href={`/session/${active.session.id}`} className="active-banner">
              <span className="active-dot" />
              <span>Workout in progress — <b>{active.session.name}</b></span>
              <Icon name="chevron" />
            </Link>
          )}
          {children}
        </main>

        {!inSession && (
          <nav className="tabbar">
            {TABS.map(t => t.href === "__workout" ? (
              <button key={t.href} className="tabbar-item tabbar-main" onClick={goWorkout}>
                <Icon name={active?.session ? "play" : t.icon} size={22} />
                <span>{active?.session ? "Resume" : "Workout"}</span>
              </button>
            ) : (
              <Link key={t.href} href={t.href} className={`tabbar-item ${isActive(path, t.href) ? "active" : ""}`}>
                <Icon name={t.icon} size={20} />
                <span>{t.label}</span>
              </Link>
            ))}
            <button className="tabbar-item" onClick={() => setOpen(true)}>
              <Icon name="menu" size={20} />
              <span>More</span>
            </button>
          </nav>
        )}
      </div>
    </MeContext.Provider>
  );
}
