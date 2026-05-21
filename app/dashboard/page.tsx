"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface Stats {
  total_users: number;
  total_workouts: number;
  total_runs: number;
  total_distance_meters: number;
  active_today: number;
}

export default function DashboardOverview() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch("/api/admin/stats")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data) setStats(data); })
      .catch(() => {});
  }, []);

  return (
    <>
      <div className="dash-header">
        <div>
          <h1 className="dash-title">Overview</h1>
          <p className="dash-subtitle">AstroFit admin — manage users and site settings.</p>
        </div>
        <Link href="/dashboard/users" className="btn btn-primary">+ Add User</Link>
      </div>

      {stats ? (
        <div className="stats-row">
          <div className="stat-card"><div className="stat-value">{stats.total_users}</div><div className="stat-label">Users</div></div>
          <div className="stat-card"><div className="stat-value">{stats.total_workouts}</div><div className="stat-label">Total Workouts</div></div>
          <div className="stat-card"><div className="stat-value">{stats.total_runs}</div><div className="stat-label">Total Runs</div></div>
          <div className="stat-card">
            <div className="stat-value">{(stats.total_distance_meters / 1000).toFixed(0)} km</div>
            <div className="stat-label">Total Distance</div>
          </div>
        </div>
      ) : (
        <p style={{ color: "var(--text-muted)" }}>Loading…</p>
      )}

      <div style={{ display: "flex", gap: "10px", marginTop: "32px", flexWrap: "wrap" }}>
        <Link href="/dashboard/users" className="btn btn-secondary">Manage Users</Link>
        <Link href="/dashboard/notifications" className="btn btn-secondary">Push Notifications</Link>
        <Link href="/dashboard/settings" className="btn btn-secondary">Settings</Link>
      </div>
    </>
  );
}
