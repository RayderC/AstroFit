"use client";

import Link from "next/link";
import { useMe } from "./MeContext";
import { fmtDistance, fmtDuration, kgTo } from "@/lib/units";
import type { SessionSummary } from "@/lib/types";

export default function SessionRow({ s }: { s: SessionSummary }) {
  const { me } = useMe();
  const d = new Date(s.startedAt);
  return (
    <Link href={`/session/${s.id}`} className="row-card">
      <div className="row-top">
        <span className="row-title">
          {s.hasLift && <span className="dot lift" />}{s.hasCardio && <span className="dot cardio" />}
          {s.name}
        </span>
        <span className="row-sub">{d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</span>
      </div>
      <div className="row-body">{s.exercises.slice(0, 6).join(" · ")}{s.exercises.length > 6 ? ` +${s.exercises.length - 6}` : ""}</div>
      <div className="row-stats">
        <span><b>{fmtDuration(s.durationS, { long: true })}</b></span>
        {s.hasLift && <span><b>{s.liftSets}</b> sets</span>}
        {s.hasLift && <span><b>{Math.round(kgTo(s.volumeKg, me.weightUnit)).toLocaleString()}</b> {me.weightUnit}</span>}
        {s.cardioM > 0 && <span><b>{fmtDistance(s.cardioM, me.distanceUnit)}</b> {me.distanceUnit}</span>}
      </div>
    </Link>
  );
}
