"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface User {
  id: number;
  username: string;
  is_admin: number;
  xp: number;
  level: number;
  streak_days: number;
  created_at: string;
}

export default function AdminUsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newUser, setNewUser] = useState({ username: "", password: "", isAdmin: false });
  const [creating, setCreating] = useState(false);
  const [resetPasswords, setResetPasswords] = useState<Record<number, string>>({});

  useEffect(() => {
    fetch("/api/users").then(async r => {
      if (r.status === 403) { router.push("/dashboard"); return; }
      setUsers(await r.json());
      setLoading(false);
    });
  }, [router]);

  const createUser = async () => {
    if (!newUser.username.trim() || !newUser.password) { alert("Username and password required"); return; }
    setCreating(true);
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newUser),
    });
    const data = await res.json();
    if (res.ok) {
      setNewUser({ username: "", password: "", isAdmin: false });
      setShowCreate(false);
      const fresh = await fetch("/api/users").then(r => r.json());
      setUsers(fresh);
    } else {
      alert(data.message);
    }
    setCreating(false);
  };

  const toggleAdmin = async (user: User) => {
    await fetch(`/api/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isAdmin: !user.is_admin }),
    });
    setUsers(us => us.map(u => u.id === user.id ? { ...u, is_admin: u.is_admin ? 0 : 1 } : u));
  };

  const resetPassword = async (userId: number) => {
    const pw = resetPasswords[userId];
    if (!pw || pw.length < 8) { alert("Password must be at least 8 characters"); return; }
    const res = await fetch(`/api/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newPassword: pw }),
    });
    if (res.ok) {
      setResetPasswords(p => { const n = { ...p }; delete n[userId]; return n; });
      alert("Password updated");
    }
  };

  const deleteUser = async (userId: number) => {
    if (!confirm("Delete this user and all their data?")) return;
    await fetch(`/api/users/${userId}`, { method: "DELETE", headers: { "Content-Type": "application/json" } });
    setUsers(us => us.filter(u => u.id !== userId));
  };

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="content-wide">
      <div className="dash-header">
        <div>
          <button className="back-link" onClick={() => router.push("/dashboard/admin")}>
            ← Admin
          </button>
          <h1 className="dash-title" style={{ marginTop: 4 }}>Users</h1>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(!showCreate)}>+ Add User</button>
      </div>

      {showCreate && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header">
            <span className="card-title">New User</span>
          </div>
          <div className="inline-form">
            <input
              className="form-input"
              placeholder="Username"
              value={newUser.username}
              onChange={e => setNewUser(p => ({ ...p, username: e.target.value }))}
              autoFocus
            />
            <input
              className="form-input"
              type="password"
              placeholder="Password (min 8 chars)"
              value={newUser.password}
              onChange={e => setNewUser(p => ({ ...p, password: e.target.value }))}
            />
            <label className="flex items-center gap-2" style={{ cursor: "pointer", fontSize: 14 }}>
              <input
                type="checkbox"
                checked={newUser.isAdmin}
                onChange={e => setNewUser(p => ({ ...p, isAdmin: e.target.checked }))}
              />
              Admin
            </label>
            <div className="form-actions">
              <button className="btn btn-primary btn-sm" onClick={createUser} disabled={creating}>
                {creating ? "Creating..." : "Create"}
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowCreate(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex-col gap-2">
        {users.map(u => (
          <div key={u.id} className="card">
            <div className="admin-user-row" style={{ padding: 0 }}>
              <div className="admin-user-top">
                <div>
                  <div className="admin-user-name">
                    {u.username}
                    {u.is_admin === 1 && <span className="badge badge-purple">Admin</span>}
                  </div>
                  <div className="admin-user-meta">Level {u.level} · {u.xp.toLocaleString()} XP · {u.streak_days}d streak</div>
                  <div className="admin-user-joined">Joined {new Date(u.created_at).toLocaleDateString()}</div>
                </div>
                <div className="admin-user-actions">
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => toggleAdmin(u)}
                    title={u.is_admin ? "Remove admin" : "Make admin"}
                  >
                    {u.is_admin ? "Un-admin" : "Admin"}
                  </button>
                  <button className="btn btn-danger btn-sm" onClick={() => deleteUser(u.id)}>
                    Delete
                  </button>
                </div>
              </div>
              <div className="admin-pw-row">
                <input
                  className="form-input"
                  type="password"
                  placeholder="New password"
                  value={resetPasswords[u.id] ?? ""}
                  onChange={e => setResetPasswords(p => ({ ...p, [u.id]: e.target.value }))}
                />
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => resetPassword(u.id)}
                  disabled={!resetPasswords[u.id]}
                >
                  Reset
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
