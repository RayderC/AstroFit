"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AuthShell from "@/app/components/AuthShell";

export default function SetupPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [wu, setWu] = useState<"lb" | "kg">("lb");
  const [du, setDu] = useState<"mi" | "km">("mi");

  useEffect(() => {
    fetch("/api/setup").then(r => r.json()).then(d => { if (!d?.needsSetup) router.replace("/login"); });
  }, [router]);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (f.get("password") !== f.get("confirm")) return setError("Passwords don't match");
    setError("");
    setLoading(true);
    const res = await fetch("/api/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: f.get("username"), password: f.get("password"), weightUnit: wu, distanceUnit: du }),
    });
    setLoading(false);
    if (res.ok) router.replace("/");
    else setError((await res.json().catch(() => ({}))).message || "Setup failed");
  }

  return (
    <AuthShell title="First-time setup" subtitle="Create the admin account. You can add more people later.">
      <form onSubmit={submit} className="auth-form">
        {error && <p className="form-error">{error}</p>}
        <div className="form-group">
          <label className="form-label" htmlFor="username">Username</label>
          <input id="username" name="username" className="form-input" autoCapitalize="none" autoComplete="username" required />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="password">Password</label>
          <input id="password" name="password" type="password" className="form-input" autoComplete="new-password" minLength={8} required />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="confirm">Confirm password</label>
          <input id="confirm" name="confirm" type="password" className="form-input" autoComplete="new-password" minLength={8} required />
        </div>
        <div className="form-grid-2">
          <div className="form-group">
            <span className="form-label">Weight</span>
            <div className="seg">
              {(["lb", "kg"] as const).map(u => <button type="button" key={u} className={wu === u ? "on" : ""} onClick={() => setWu(u)}>{u}</button>)}
            </div>
          </div>
          <div className="form-group">
            <span className="form-label">Distance</span>
            <div className="seg">
              {(["mi", "km"] as const).map(u => <button type="button" key={u} className={du === u ? "on" : ""} onClick={() => setDu(u)}>{u}</button>)}
            </div>
          </div>
        </div>
        <button className="btn-primary btn-lg" disabled={loading}>{loading ? "Creating…" : "Create account"}</button>
      </form>
    </AuthShell>
  );
}
