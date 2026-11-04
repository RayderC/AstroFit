"use client";

import Link from "next/link";
import { useState } from "react";
import Icon from "@/app/components/Icon";
import { RestModal } from "@/app/components/session/LiftCard";
import { useMe } from "@/app/components/MeContext";
import { api } from "@/lib/client";
import { fmtDuration } from "@/lib/units";

export default function SettingsPage() {
  const { me, reloadMe } = useMe();
  const [rest, setRest] = useState(false);
  const [pw, setPw] = useState({ current: "", next: "" });
  const [msg, setMsg] = useState("");

  async function set(body: Record<string, unknown>) {
    await api("/api/me", { method: "PATCH", body });
    reloadMe();
  }

  async function changePw(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    try { await api("/api/me/password", { body: pw }); setPw({ current: "", next: "" }); setMsg("Password changed"); }
    catch (x) { setMsg((x as Error).message); }
  }

  return (
    <div className="page page-narrow">
      <div className="dash-header"><div><h1 className="dash-title">Settings</h1><p className="dash-subtitle">Signed in as {me.username}</p></div></div>

      <div className="card section">
        <div className="card-title" style={{ marginBottom: 6 }}>Units</div>
        <div className="settings-row">
          <div><div className="settings-label">Weight</div><div className="settings-hint">Switching converts everything — nothing is lost</div></div>
          <div className="seg">{(["lb", "kg"] as const).map(u => <button key={u} className={me.weightUnit === u ? "on" : ""} onClick={() => set({ weightUnit: u })}>{u}</button>)}</div>
        </div>
        <div className="settings-row">
          <div><div className="settings-label">Distance</div></div>
          <div className="seg">{(["mi", "km"] as const).map(u => <button key={u} className={me.distanceUnit === u ? "on" : ""} onClick={() => set({ distanceUnit: u })}>{u}</button>)}</div>
        </div>
        <div className="settings-row">
          <div><div className="settings-label">Default rest timer</div><div className="settings-hint">Per-exercise rest overrides this</div></div>
          <button className="btn-secondary btn-sm" onClick={() => setRest(true)}>{me.restDefault ? fmtDuration(me.restDefault) : "Off"}</button>
        </div>
      </div>

      <div className="card section">
        <div className="card-title" style={{ marginBottom: 6 }}>Your data</div>
        <div className="settings-row">
          <div><div className="settings-label">Import from Strong</div><div className="settings-hint">Bring in your Strong workout history (CSV export)</div></div>
          <Link href="/settings/import" className="btn-secondary btn-sm"><Icon name="upload" size={14} /> Import</Link>
        </div>
        <div className="settings-row">
          <div><div className="settings-label">Export</div><div className="settings-hint">CSV (one row per set, Strong-style) or full JSON backup</div></div>
          <div className="flex gap-2">
            <a className="btn-secondary btn-sm" href="/api/export?format=csv"><Icon name="download" size={14} /> CSV</a>
            <a className="btn-secondary btn-sm" href="/api/export?format=json"><Icon name="download" size={14} /> JSON</a>
          </div>
        </div>
      </div>

      <form className="card section" onSubmit={changePw}>
        <div className="card-title" style={{ marginBottom: 12 }}>Change password</div>
        <div className="form-stack">
          <input type="password" className="form-input" placeholder="Current password" autoComplete="current-password" value={pw.current} onChange={e => setPw({ ...pw, current: e.target.value })} />
          <input type="password" className="form-input" placeholder="New password (8+ characters)" autoComplete="new-password" value={pw.next} onChange={e => setPw({ ...pw, next: e.target.value })} />
          <div className="flex gap-2 items-center"><button className="btn-primary" disabled={!pw.current || pw.next.length < 8}>Change</button>{msg && <span className="text-muted" style={{ fontSize: 13 }}>{msg}</span>}</div>
        </div>
      </form>

      {rest && <RestModal value={me.restDefault} showDefault={false} onClose={() => setRest(false)} onSave={v => set({ restDefault: v })} />}
    </div>
  );
}
