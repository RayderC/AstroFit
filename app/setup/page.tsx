"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const TRACES = [
  { d: 'M 0,180 H 140 V 240 H 280',           cls: 'purple', delay: '0s'   },
  { d: 'M 0,400 H 110 V 345 H 230 V 305',     cls: 'cyan',   delay: '0.4s' },
  { d: 'M 0,620 H 170 V 565 H 310',           cls: 'purple', delay: '0.8s' },
  { d: 'M 1200,200 H 1060 V 260 H 930',       cls: 'cyan',   delay: '0.2s' },
  { d: 'M 1200,450 H 1090 V 390 H 970 V 350', cls: 'purple', delay: '0.6s' },
  { d: 'M 1200,660 H 1030 V 610 H 890',       cls: 'cyan',   delay: '1.0s' },
  { d: 'M 320,0 V 110 H 375 V 165',           cls: 'purple', delay: '0.3s' },
  { d: 'M 760,0 V 95 H 815 V 150',            cls: 'cyan',   delay: '0.7s' },
  { d: 'M 270,800 V 695 H 215 V 650',         cls: 'cyan',   delay: '0.5s' },
  { d: 'M 860,800 V 715 H 915 V 655',         cls: 'purple', delay: '0.9s' },
];

const NODES: [number, number, string][] = [
  [140,180,'purple'],[140,240,'cyan'],[280,240,'purple'],
  [110,400,'cyan'],[110,345,'purple'],[230,345,'cyan'],[230,305,'purple'],
  [170,620,'cyan'],[170,565,'purple'],[310,565,'cyan'],
  [1060,200,'purple'],[1060,260,'cyan'],[930,260,'purple'],
  [1090,450,'cyan'],[1090,390,'purple'],[970,390,'cyan'],[970,350,'purple'],
  [1030,660,'purple'],[1030,610,'cyan'],[890,610,'purple'],
  [320,110,'cyan'],[375,110,'purple'],[375,165,'cyan'],
  [760,95,'purple'],[815,95,'cyan'],[815,150,'purple'],
  [270,695,'cyan'],[215,695,'purple'],[215,650,'cyan'],
  [860,715,'purple'],[915,715,'cyan'],[915,655,'purple'],
];

export default function SetupPage() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/setup")
      .then(r => r.json())
      .then(d => { if (!d?.needsSetup) router.replace("/login"); else setChecking(false); })
      .catch(() => setChecking(false));
  }, [router]);

  if (checking) return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="loading">Checking setup status…</div>
      </div>
    </div>
  );

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const form = e.currentTarget as HTMLFormElement & {
      username: { value: string };
      password: { value: string };
      confirm:  { value: string };
    };
    if (form.password.value !== form.confirm.value) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }
    const res = await fetch("/api/setup", {
      method: "POST",
      body: JSON.stringify({ username: form.username.value.trim().toLowerCase(), password: form.password.value }),
      headers: { "Content-Type": "application/json" },
    });
    setLoading(false);
    if (res.ok) router.push("/dashboard");
    else setError((await res.json()).message || "Setup failed");
  }

  return (
    <div className="auth-page">
      <div className="login-bg" aria-hidden>
        <svg className="login-circuit-svg" viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice">
          {TRACES.map((t, i) => (
            <path key={i} className={`circuit-trace ${t.cls}`} d={t.d} style={{ animationDelay: t.delay }} />
          ))}
          {NODES.map(([cx, cy, cls], i) => (
            <circle key={i} className={`circuit-node ${cls}`} cx={cx} cy={cy} r="3"
              style={{ animationDelay: `${(i * 0.11 + 0.6).toFixed(2)}s` }} />
          ))}
        </svg>
        <div className="login-scanline" />
      </div>

      <div className="auth-card">
        <Link href="/" className="auth-logo-wrap">
          <img src="/logo.png" alt="AstroFit" className="auth-logo-img" />
          <span className="auth-logo">AstroFit</span>
        </Link>

        <h1 className="auth-title">First-time setup</h1>
        <p className="auth-subtitle">Create your admin account to get started.</p>

        <form onSubmit={handleSubmit} className="auth-form">
          {error && <p className="form-error">{error}</p>}
          <div className="form-group">
            <label className="form-label" htmlFor="username">Username</label>
            <input type="text" id="username" name="username" className="form-input"
              placeholder="admin" autoComplete="username" required />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="password">Password</label>
            <input type="password" id="password" name="password" className="form-input"
              placeholder="At least 8 characters" minLength={8} required />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="confirm">Confirm password</label>
            <input type="password" id="confirm" name="confirm" className="form-input"
              placeholder="Repeat password" minLength={8} required />
          </div>
          <button type="submit" className="btn btn-primary btn-lg" disabled={loading}>
            {loading ? "Creating account…" : "Create Admin Account"}
          </button>
        </form>
      </div>
    </div>
  );
}
