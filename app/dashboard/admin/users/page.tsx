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
    <div style={{ maxWidth: 700 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <button onClick={() => router.push("/dashboard/admin")} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "0.85rem", padding: 0, marginBottom: 4 }}>
            ← Admin
          </button>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>Users</h1>
        </div>
        <button className="btn-primary btn-sm" onClick={() => setShowCreate(!showCreate)}>+ Add User</button>
      </div>

      {showCreate && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h3 style={{ marginBottom: 12 }}>New User</h3>
          <div style={{ display: "grid", gap: 10 }}>
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
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.9rem", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={newUser.isAdmin}
                onChange={e => setNewUser(p => ({ ...p, isAdmin: e.target.checked }))}
              />
              Admin
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn-primary btn-sm" onClick={createUser} disabled={creating}>
                {creating ? "Creating..." : "Create"}
              </button>
              <button className="btn-secondary btn-sm" onClick={() => setShowCreate(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {users.map(u => (
          <div key={u.id} className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontWeight: 700 }}>{u.username}</span>
                  {u.is_admin === 1 && (
                    <span style={{ fontSize: "0.7rem", background: "rgba(124,14,179,0.2)", color: "var(--primary-light)", padding: "1px 6px", borderRadius: 4 }}>Admin</span>
                  )}
                </div>
                <div style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginTop: 2 }}>
                  Level {u.level} · {u.xp.toLocaleString()} XP · {u.streak_days}d streak
                </div>
                <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: 1 }}>
                  Joined {new Date(u.created_at).toLocaleDateString()}
                </div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  className="btn-secondary btn-sm"
                  onClick={() => toggleAdmin(u)}
                  title={u.is_admin ? "Remove admin" : "Make admin"}
                >
                  {u.is_admin ? "Un-admin" : "Admin"}
                </button>
                <button className="btn-danger btn-sm" onClick={() => deleteUser(u.id)}>
                  Delete
                </button>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                className="form-input"
                type="password"
                placeholder="New password"
                value={resetPasswords[u.id] ?? ""}
                onChange={e => setResetPasswords(p => ({ ...p, [u.id]: e.target.value }))}
                style={{ fontSize: "0.85rem", flex: 1 }}
              />
              <button
                className="btn-secondary btn-sm"
                onClick={() => resetPassword(u.id)}
                disabled={!resetPasswords[u.id]}
              >
                Reset
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
