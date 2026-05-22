"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function Login() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/setup")
      .then((r) => r.json())
      .then((data) => { if (data?.needsSetup) router.replace("/setup"); })
      .catch(() => {});
  }, [router]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const form = e.target as HTMLFormElement & {
      username: { value: string };
      password: { value: string };
    };
    const res = await fetch("/api/login", {
      method: "POST",
      body: JSON.stringify({
        username: form.username.value.trim().toLowerCase(),
        password: form.password.value,
      }),
      headers: { "Content-Type": "application/json" },
    });
    setLoading(false);
    if (res.ok) {
      router.push("/");
    } else {
      setError((await res.json()).message || "Authentication failed");
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-eyebrow">The System</div>
        <div className="auth-logo">AstroFit</div>
        <h1 className="auth-title">Hunter Identification</h1>
        <p className="auth-subtitle">// authentication required</p>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
          {error && (
            <div style={{
              padding: "10px 14px",
              background: "rgba(239,68,68,0.08)",
              border: "1px solid rgba(239,68,68,0.25)",
              borderRadius: "var(--radius-sm)",
              color: "var(--danger)",
              fontSize: "13px",
              fontFamily: "var(--font-mono)",
            }}>
              ⚠ {error}
            </div>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="username" style={{ fontFamily: "var(--font-mono)", color: "var(--primary-light)" }}>
              Hunter ID
            </label>
            <input
              type="text"
              id="username"
              name="username"
              className="form-input"
              placeholder="enter username"
              autoComplete="username"
              required
              style={{ fontFamily: "var(--font-mono)" }}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password" style={{ fontFamily: "var(--font-mono)", color: "var(--primary-light)" }}>
              Access Code
            </label>
            <input
              type="password"
              id="password"
              name="password"
              className="form-input"
              placeholder="••••••••"
              autoComplete="current-password"
              required
              style={{ fontFamily: "var(--font-mono)" }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: "8px",
              padding: "12px",
              background: loading ? "rgba(168,85,247,0.2)" : "linear-gradient(135deg, var(--primary) 0%, #5b1a8a 100%)",
              color: "#fff",
              border: "1px solid rgba(168,85,247,0.5)",
              borderRadius: "var(--radius-sm)",
              fontWeight: 700,
              fontSize: "13px",
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              fontFamily: "var(--font-mono)",
              cursor: loading ? "not-allowed" : "pointer",
              transition: "all 0.15s",
              boxShadow: loading ? "none" : "0 0 20px rgba(168,85,247,0.3)",
            }}
          >
            {loading ? "Verifying…" : "Enter The System"}
          </button>
        </form>
      </div>
    </div>
  );
}
