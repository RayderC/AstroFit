"use client";

import { useEffect, useState } from "react";

interface LogRow {
  id: number;
  user_id: number | null;
  username: string | null;
  endpoint_host: string;
  status_code: number | null;
  error: string;
  title: string;
  created_at: string;
}

function statusColor(code: number | null, error: string): string {
  if (code != null && code >= 200 && code < 300) return "var(--success)";
  if (code === 410 || code === 404) return "var(--text-subtle)";
  if (error) return "var(--danger)";
  return "var(--text)";
}

export default function NotificationsDashboard() {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const r = await fetch("/api/admin/notifications");
    if (r.ok) setRows(await r.json());
    setLoading(false);
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 15_000);
    return () => clearInterval(t);
  }, []);

  return (
    <>
      <div className="dash-header">
        <div>
          <h1 className="dash-title">Push notifications</h1>
          <p className="dash-subtitle">
            Last 50 push attempts. 201/202 = accepted. 410/404 = subscription removed by push service.
            Other status codes or non-empty error text usually mean a VAPID problem (Apple
            rejects subjects without a real domain).
          </p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={load} disabled={loading}>
          Refresh
        </button>
      </div>

      {loading && rows.length === 0 ? (
        <p style={{ color: "var(--text-muted)" }}>Loading…</p>
      ) : rows.length === 0 ? (
        <div className="empty-state">
          <p className="empty-title">No push attempts yet</p>
          <p className="empty-desc">Send a test from the profile page or wait for a chapter to download.</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>When</th>
                <th>User</th>
                <th>Service</th>
                <th>Status</th>
                <th>Title / error</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td style={{ fontFamily: "var(--font-mono)", fontSize: "12px" }}>{r.created_at}</td>
                  <td>{r.username || `#${r.user_id ?? "?"}`}</td>
                  <td style={{ fontFamily: "var(--font-mono)", fontSize: "12px" }}>{r.endpoint_host}</td>
                  <td style={{ color: statusColor(r.status_code, r.error), fontWeight: 600 }}>
                    {r.status_code ?? "—"}
                  </td>
                  <td style={{ fontSize: "12px" }}>
                    {r.title && <span>{r.title}</span>}
                    {r.error && <div style={{ color: "var(--danger)", marginTop: "2px" }}>{r.error}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
