"use client";

import { useState } from "react";
import BackupsCard from "@/app/components/BackupsCard";
import GeminiSetup from "@/app/components/GeminiSetup";
import UpdateNotice from "@/app/components/UpdateNotice";
import Icon from "@/app/components/Icon";
import Modal from "@/app/components/Modal";
import { useMe } from "@/app/components/MeContext";
import { api, fmtDate, useApi } from "@/lib/client";

type U = { id: number; username: string; isAdmin: boolean; disabled: boolean; createdAt: string; sessions: number; lastWorkout: string | null };

export default function AdminPage() {
  const { me } = useMe();
  const { data, error, reload } = useApi<U[]>(me.isAdmin ? "/api/admin/users" : null);
  const [creating, setCreating] = useState(false);
  const [editingUser, setEditingUser] = useState<U | null>(null);
  const [err, setErr] = useState("");

  if (!me.isAdmin) return <div className="empty-state"><div className="empty-state-title">Admins only</div></div>;

  async function act(fn: () => Promise<unknown>) {
    setErr("");
    try { await fn(); await reload(); }
    catch (e) { setErr((e as Error).message); }
  }
  const remove = (u: U) => {
    if (!confirm(`Delete ${u.username} and all their workouts, routines and body data? This can't be undone.`)) return;
    act(() => api(`/api/admin/users/${u.id}`, { method: "DELETE" }));
  };

  return (
    <div className="page page-narrow">
      <div className="dash-header">
        <div><h1 className="dash-title">Admin</h1><p className="dash-subtitle">Accounts on this server</p></div>
        <button className="btn-primary btn-sm" onClick={() => setCreating(true)}><Icon name="plus" size={14} /> New user</button>
      </div>
      <UpdateNotice />
      {(err || error) && <p className="form-error" style={{ marginBottom: 12 }}>{err || error}</p>}
      {!data ? !error && <div className="loading">Loading…</div> : (
        <div className="row-list">
          {data.map(u => {
            const self = u.id === me.id;
            return (
              <div key={u.id} className="row-card" data-user={u.username}>
                <div className="row-top">
                  <span className="row-title">{u.username}{self && <span className="row-sub"> (you)</span>}</span>
                  <span className="flex gap-2">
                    {u.isAdmin && <span className="badge badge-purple">Admin</span>}
                    {u.disabled && <span className="badge badge-red">Disabled</span>}
                  </span>
                </div>
                <div className="row-stats">
                  <span><b>{u.sessions}</b> workouts</span>
                  <span>Last {u.lastWorkout ? fmtDate(u.lastWorkout) : "never"}</span>
                  <span>Joined {fmtDate(u.createdAt)}</span>
                </div>
                <div className="flex gap-2" style={{ marginTop: 10, flexWrap: "wrap" }}>
                  <button className="btn-secondary btn-sm" onClick={() => setEditingUser(u)}><Icon name="edit" size={13} /> Edit</button>
                  {!self && !u.disabled && <button className="btn-secondary btn-sm" onClick={() => {
                    if (confirm(`Sign ${u.username} out of every device?`)) act(() => api(`/api/admin/users/${u.id}/sign-out`, { method: "POST" }));
                  }}>Sign out</button>}
                  {!self && <button className="btn-danger btn-sm" onClick={() => remove(u)}>Delete</button>}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <div className="section">
        <div className="section-header"><h2 className="section-title">Optional services</h2></div>
        <GeminiSetup />
        <p className="settings-hint">On Google&apos;s free tier, what&apos;s sent to Gemini may be used to improve Google&apos;s products. Coach notes send training and body stats and the plan, never names or usernames.</p>
      </div>
      <BackupsCard appName="AstroFit" what="every workout, routine, food and body entry" />
      {creating && <CreateUser onClose={() => setCreating(false)} onDone={() => { setCreating(false); reload(); }} />}
      {editingUser && <EditUser user={editingUser} self={editingUser.id === me.id} onClose={() => setEditingUser(null)} onDone={() => { setEditingUser(null); act(async () => {}); }} />}
    </div>
  );
}

function CreateUser({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [err, setErr] = useState("");
  async function save() {
    setErr("");
    try { await api("/api/admin/users", { body: { username, password, isAdmin } }); onDone(); }
    catch (e) { setErr((e as Error).message); }
  }
  return (
    <Modal title="New user" onClose={onClose} footer={<button className="btn-primary" onClick={save} disabled={!username.trim() || password.length < 8}>Create</button>}>
      <div className="form-stack">
        {err && <p className="form-error">{err}</p>}
        <div className="form-group"><label className="form-label" htmlFor="nu-name">Username</label><input id="nu-name" className="form-input" autoCapitalize="none" autoComplete="off" value={username} onChange={e => setUsername(e.target.value)} autoFocus /></div>
        <div className="form-group"><label className="form-label" htmlFor="nu-pw">Password (8+ characters)</label><input id="nu-pw" type="password" className="form-input" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} /></div>
        <label className="check-row"><input type="checkbox" checked={isAdmin} onChange={e => setIsAdmin(e.target.checked)} /> Admin</label>
      </div>
    </Modal>
  );
}

/** Everything about an account in one place: name, password, admin, and whether it can sign in. */
function EditUser({ user, self, onClose, onDone }: { user: U; self: boolean; onClose: () => void; onDone: () => void }) {
  const [username, setUsername] = useState(user.username);
  const [password, setPassword] = useState("");
  const [isAdmin, setIsAdmin] = useState(user.isAdmin);
  const [disabled, setDisabled] = useState(user.disabled);
  const [err, setErr] = useState("");
  async function save() {
    setErr("");
    const body: Record<string, unknown> = {};
    if (username.trim().toLowerCase() !== user.username) body.username = username;
    if (password) body.password = password;
    if (isAdmin !== user.isAdmin) body.isAdmin = isAdmin;
    if (disabled !== user.disabled) body.disabled = disabled;
    if (!Object.keys(body).length) return onClose();
    try {
      await api(`/api/admin/users/${user.id}`, { method: "PATCH", body });
      // A new password for yourself ends this session too.
      if (self && password) window.location.replace("/login");
      else onDone();
    } catch (e) { setErr((e as Error).message); }
  }
  return (
    <Modal title={`Edit ${user.username}`} onClose={onClose}
      footer={<button className="btn-primary" onClick={save} disabled={username.trim().length < 2 || (password.length > 0 && password.length < 8)}>Save</button>}>
      <div className="form-stack">
        {err && <p className="form-error">{err}</p>}
        <div className="form-group"><label className="form-label" htmlFor="eu-name">Username</label>
          <input id="eu-name" className="form-input" autoCapitalize="none" autoComplete="off" maxLength={40} value={username} onChange={e => setUsername(e.target.value)} />
          <p className="form-hint">They sign in with the new name from now on. Nobody is signed out.</p></div>
        <div className="form-group"><label className="form-label" htmlFor="eu-pw">New password</label>
          <input id="eu-pw" type="password" className="form-input" autoComplete="new-password" maxLength={72} placeholder="Leave empty to keep the current one" value={password} onChange={e => setPassword(e.target.value)} />
          <p className="form-hint">8 or more characters. Setting one signs {self ? "you" : user.username} out of every device.</p></div>
        {!self && (
          <>
            <label className="check-row"><input type="checkbox" checked={isAdmin} onChange={e => setIsAdmin(e.target.checked)} /> Admin</label>
            <label className="check-row"><input type="checkbox" checked={disabled} onChange={e => setDisabled(e.target.checked)} /> Disabled (can&apos;t sign in)</label>
          </>
        )}
      </div>
    </Modal>
  );
}
