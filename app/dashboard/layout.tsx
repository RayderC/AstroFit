"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Me = { username: string; isAdmin: boolean; level: number; xp: number; streakDays: number; xpProgress: { current: number; needed: number; level: number } };

const NAV = [
  { href: "/dashboard",            label: "Dashboard",  icon: "⚡" },
  { href: "/dashboard/workout",    label: "Workout",    icon: "💪" },
  { href: "/dashboard/cardio",     label: "Cardio",     icon: "🏃" },
  { href: "/dashboard/history",    label: "History",    icon: "📋" },
  { href: "/dashboard/progress",   label: "Progress",   icon: "📈" },
  { href: "/dashboard/challenges", label: "Challenges", icon: "🎯" },
  { href: "/dashboard/templates",  label: "Templates",  icon: "📝" },
  { href: "/dashboard/exercises",  label: "Exercises",  icon: "🏋️" },
  { href: "/dashboard/profile",    label: "Profile",    icon: "👤" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    fetch("/api/me")
      .then(r => { if (r.status === 401) router.replace("/login"); return r.json(); })
      .then(d => setMe(d))
      .catch(() => router.replace("/login"));
  }, [router]);

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    router.push("/login");
  }

  const pct = me ? Math.round((me.xpProgress.current / me.xpProgress.needed) * 100) : 0;

  return (
    <div className="app-shell">
      {/* Sidebar */}
      <aside className={`sidebar${sidebarOpen ? " open" : ""}`}>
        <div className="sidebar-logo">
          <span>⚡</span> AstroFit
        </div>

        {me && (
          <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
              <span className="level-badge">Lvl {me.level}</span>
              {me.streakDays > 0 && (
                <span className="streak-badge">🔥 {me.streakDays}d</span>
              )}
            </div>
            <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "6px" }}>
              {me.xpProgress.current} / {me.xpProgress.needed} XP
            </div>
            <div className="xp-bar-wrap">
              <div className="xp-bar-fill" style={{ width: `${pct}%` }} />
            </div>
          </div>
        )}

        <nav className="sidebar-nav">
          {NAV.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-item${pathname === item.href ? " active" : ""}`}
              onClick={() => setSidebarOpen(false)}
            >
              <span style={{ fontSize: "16px" }}>{item.icon}</span>
              {item.label}
            </Link>
          ))}

          {me?.isAdmin && (
            <>
              <div className="nav-section-label">Admin</div>
              <Link href="/dashboard/admin" className={`nav-item${pathname?.startsWith("/dashboard/admin") ? " active" : ""}`} onClick={() => setSidebarOpen(false)}>
                <span style={{ fontSize: "16px" }}>⚙️</span> Admin Panel
              </Link>
            </>
          )}
        </nav>

        <div className="sidebar-footer">
          <button onClick={logout} className="nav-item" style={{ width: "100%", background: "none", border: "none", textAlign: "left", cursor: "pointer" }}>
            <span style={{ fontSize: "16px" }}>🚪</span> Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile toggle */}
      <button
        onClick={() => setSidebarOpen(o => !o)}
        style={{
          display: "none",
          position: "fixed", top: 16, left: 16, zIndex: 200,
          background: "var(--surface)", border: "1px solid var(--border-bright)",
          borderRadius: "8px", padding: "8px 10px", cursor: "pointer",
          color: "var(--text)", fontSize: "16px",
        }}
        className="mobile-menu-btn"
        aria-label="Toggle menu"
      >
        ☰
      </button>

      <main className="main-content">
        {children}
      </main>

      <style>{`
        @media (max-width: 768px) {
          .mobile-menu-btn { display: flex !important; }
        }
      `}</style>
    </div>
  );
}
