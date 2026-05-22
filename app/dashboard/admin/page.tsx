"use client";
import { useState, useEffect } from "react";
import Link from "next/link";

const TARGET_TYPES = [
  { value: "workout_count", label: "Workouts Completed" },
  { value: "cardio_km", label: "Cardio Distance (km)" },
  { value: "cardio_count", label: "Cardio Sessions" },
  { value: "volume_kg", label: "Volume Lifted (kg)" },
  { value: "pr_count", label: "Personal Records" },
];

const CATEGORIES = ["strength", "cardio", "wildcard"];

interface Challenge {
  id: number;
  title: string;
  category: string;
  target_type: string;
  target_value: number;
  xp_reward: number;
  starts_at: string;
  ends_at: string;
  type: string;
}

export default function AdminPage() {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "strength",
    targetType: "workout_count",
    targetValue: "5",
    xpReward: "150",
    startsAt: new Date().toISOString().split("T")[0],
    endsAt: new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0],
  });

  useEffect(() => {
    fetch("/api/challenges").then(r => r.json()).then(d => { setChallenges(d); setLoading(false); });
  }, []);

  const createChallenge = async () => {
    if (!form.title.trim()) { alert("Title required"); return; }
    setCreating(true);
    const res = await fetch("/api/challenges", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        category: form.category,
        targetType: form.targetType,
        targetValue: Number(form.targetValue),
        xpReward: Number(form.xpReward),
        startsAt: new Date(form.startsAt).toISOString(),
        endsAt: new Date(form.endsAt + "T23:59:59").toISOString(),
      }),
    });
    if (res.ok) {
      const fresh = await fetch("/api/challenges").then(r => r.json());
      setChallenges(fresh);
      setForm(f => ({ ...f, title: "", description: "" }));
    }
    setCreating(false);
  };

  const deleteChallenge = async (id: number) => {
    if (!confirm("Delete this challenge?")) return;
    await fetch(`/api/challenges/${id}`, { method: "DELETE", headers: { "Content-Type": "application/json" } });
    setChallenges(cs => cs.filter(c => c.id !== id));
  };

  const special = challenges.filter(c => c.type === "special");

  return (
    <div style={{ maxWidth: 700 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>Admin Panel</h1>
        <Link href="/dashboard/admin/users" className="btn-secondary btn-sm">
          Manage Users
        </Link>
      </div>

      {/* Create challenge */}
      <div className="card" style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: 16 }}>Create Special Challenge</h2>
        <div style={{ display: "grid", gap: 12 }}>
          <input
            className="form-input"
            placeholder="Challenge title"
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          />
          <input
            className="form-input"
            placeholder="Description (optional)"
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label className="form-label">Category</label>
              <select className="form-input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Target Type</label>
              <select className="form-input" value={form.targetType} onChange={e => setForm(f => ({ ...f, targetType: e.target.value }))}>
                {TARGET_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Target Value</label>
              <input className="form-input" type="number" min="1" value={form.targetValue} onChange={e => setForm(f => ({ ...f, targetValue: e.target.value }))} />
            </div>
            <div>
              <label className="form-label">XP Reward</label>
              <input className="form-input" type="number" min="1" value={form.xpReward} onChange={e => setForm(f => ({ ...f, xpReward: e.target.value }))} />
            </div>
            <div>
              <label className="form-label">Starts At</label>
              <input className="form-input" type="date" value={form.startsAt} onChange={e => setForm(f => ({ ...f, startsAt: e.target.value }))} />
            </div>
            <div>
              <label className="form-label">Ends At</label>
              <input className="form-input" type="date" value={form.endsAt} onChange={e => setForm(f => ({ ...f, endsAt: e.target.value }))} />
            </div>
          </div>
          <button className="btn-primary" onClick={createChallenge} disabled={creating} style={{ justifySelf: "start" }}>
            {creating ? "Creating..." : "Create Challenge"}
          </button>
        </div>
      </div>

      {/* Special challenges list */}
      <section>
        <h2 style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>
          Special Challenges ({special.length})
        </h2>
        {special.length === 0 ? (
          <div className="empty-state">No special challenges created yet.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {special.map(ch => (
              <div key={ch.id} className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{ch.title}</div>
                  <div style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginTop: 2 }}>
                    {ch.category} · {TARGET_TYPES.find(t => t.value === ch.target_type)?.label} = {ch.target_value} · +{ch.xp_reward} XP
                  </div>
                  <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: 2 }}>
                    {new Date(ch.starts_at).toLocaleDateString()} → {new Date(ch.ends_at).toLocaleDateString()}
                  </div>
                </div>
                <button className="btn-danger btn-sm" onClick={() => deleteChallenge(ch.id)}>Delete</button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
