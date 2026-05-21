"use client";

import Link from "next/link";
import Navigation from "../../components/Navigation";

export default function LogWorkoutPage() {
  return (
    <div>
      <Navigation />
      <div className="log-workout-page">
        <Link href="/workouts" className="back-link">← Workouts</Link>
        <div className="section-eyebrow">Log</div>
        <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 24 }}>
          What did you do?
        </h1>

        <div className="log-type-tabs">
          <Link href="/workouts/log/run" className="log-type-tab">
            🏃 Run
          </Link>
          <Link href="/workouts/log/strength" className="log-type-tab">
            💪 Strength
          </Link>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <Link href="/workouts/log/run" style={{ textDecoration: "none" }}>
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: 28, textAlign: "center", transition: "border-color 0.2s, box-shadow 0.2s" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(34,211,238,0.5)"; (e.currentTarget as HTMLDivElement).style.boxShadow = "0 0 20px rgba(34,211,238,0.1)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLDivElement).style.boxShadow = "none"; }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🏃</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text)", marginBottom: 6 }}>Log a Run</div>
              <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Manual entry, GPX import, or live GPS recording</div>
            </div>
          </Link>

          <Link href="/workouts/log/strength" style={{ textDecoration: "none" }}>
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: 28, textAlign: "center", transition: "border-color 0.2s, box-shadow 0.2s" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(244,114,182,0.5)"; (e.currentTarget as HTMLDivElement).style.boxShadow = "0 0 20px rgba(244,114,182,0.1)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLDivElement).style.boxShadow = "none"; }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>💪</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text)", marginBottom: 6 }}>Log Strength</div>
              <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Log exercises, sets, reps, and weights</div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
