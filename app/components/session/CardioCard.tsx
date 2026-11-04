"use client";

import { useEffect, useState } from "react";
import Icon from "@/app/components/Icon";
import { Sheet } from "@/app/components/Modal";
import { useMe } from "@/app/components/MeContext";
import GpsTracker from "./GpsTracker";
import RouteSvg, { splitsFromRoute } from "./RouteSvg";
import { api, fmtDate, parseNum } from "@/lib/client";
import { fmtDistance, fmtDuration, fmtPace, M_PER_MI, paceSecPer, parseDuration, toM } from "@/lib/units";
import type { CardioBlockDTO, CardioDTO, SessionDTO } from "@/lib/types";

const FT_PER_M = 3.28084;

export default function CardioCard({ block, finished, onSession, onChange }: {
  block: CardioBlockDTO;
  finished: boolean;
  onSession: (s: SessionDTO) => void;
  onChange: (blockId: number, c: CardioDTO) => void;
}) {
  const { me } = useMe();
  const du = me.distanceUnit;
  const elevUnit = du === "mi" ? "ft" : "m";
  const c = block.cardio;
  const [f, setF] = useState({ dur: "", dist: "", hr: "", elev: "", cal: "" });
  const [menu, setMenu] = useState(false);
  const [gps, setGps] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    setF({
      dur: c.durationS != null ? fmtDuration(c.durationS) : "",
      dist: c.distanceM != null ? fmtDistance(c.distanceM, du) : "",
      hr: c.avgHr != null ? String(c.avgHr) : "",
      elev: c.elevationM != null ? String(Math.round(du === "mi" ? c.elevationM * FT_PER_M : c.elevationM)) : "",
      cal: c.calories != null ? String(c.calories) : "",
    });
  }, [c.durationS, c.distanceM, c.avgHr, c.elevationM, c.calories, du]);

  function parsed(): Partial<CardioDTO> {
    const dist = parseNum(f.dist);
    const elev = parseNum(f.elev);
    return {
      durationS: f.dur ? parseDuration(f.dur) : null,
      distanceM: dist != null ? toM(dist, du) : null,
      avgHr: parseNum(f.hr),
      elevationM: elev != null ? (du === "mi" ? elev / FT_PER_M : elev) : null,
      calories: parseNum(f.cal),
    };
  }

  async function save(extra: Partial<CardioDTO> = {}) {
    setErr("");
    const body = { ...parsed(), ...extra };
    onChange(block.id, { ...c, ...body });
    try { await api(`/api/blocks/${block.id}/cardio`, { method: "PATCH", body }); }
    catch (e) { setErr((e as Error).message); }
  }

  async function toggleDone() {
    if (c.done) return save({ done: false });
    const p = parsed();
    if (!p.durationS) return setErr("Enter how long you went");
    save({ done: true });
  }

  const pace = paceSecPer(c.distanceM, c.durationS, du);
  const splits = c.route && c.route.length > 1 ? splitsFromRoute(c.route, du === "mi" ? M_PER_MI : 1000) : [];
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF(x => ({ ...x, [k]: e.target.value }));

  return (
    <div className={`lift-card cardio-card ${c.done ? "is-done" : ""}`}>
      <div className="lift-head">
        <span className="lift-name"><Icon name="run" size={16} /> {block.activity.name}</span>
        <button className="icon-btn" onClick={() => setMenu(true)} aria-label="Cardio options"><Icon name="more" /></button>
      </div>
      {block.previous && (
        <div className="cardio-prev">
          Last time ({fmtDate(block.previous.date, { month: "short", day: "numeric" })}): {fmtDuration(block.previous.durationS, { long: true })}
          {block.previous.distanceM ? ` · ${fmtDistance(block.previous.distanceM, du)} ${du} · ${fmtPace(paceSecPer(block.previous.distanceM, block.previous.durationS, du), du)}` : ""}
        </div>
      )}
      {err && <p className="form-error">{err}</p>}
      <div className="cardio-grid">
        <label><span className="form-label">Time</span>
          <input className="set-input" inputMode="numeric" placeholder="mm:ss" value={f.dur} onChange={set("dur")} onBlur={() => save()} /></label>
        {block.activity.hasDistance && <label><span className="form-label">Distance ({du})</span>
          <input className="set-input" inputMode="decimal" value={f.dist} onChange={set("dist")} onBlur={() => save()} /></label>}
        <label><span className="form-label">Avg HR</span>
          <input className="set-input" inputMode="numeric" value={f.hr} onChange={set("hr")} onBlur={() => save()} /></label>
        {block.activity.hasDistance && <label><span className="form-label">Elev ({elevUnit})</span>
          <input className="set-input" inputMode="numeric" value={f.elev} onChange={set("elev")} onBlur={() => save()} /></label>}
        <label><span className="form-label">Cal</span>
          <input className="set-input" inputMode="numeric" value={f.cal} onChange={set("cal")} onBlur={() => save()} /></label>
        <button className={`set-check big ${c.done ? "on" : ""}`} onClick={toggleDone} aria-label="Complete cardio"><Icon name="check" size={18} /></button>
      </div>
      {pace && block.activity.hasDistance && <div className="cardio-pace">Pace {fmtPace(pace, du)}</div>}
      {c.route && c.route.length > 1 && (
        <div className="cardio-route">
          <RouteSvg route={c.route} />
          {splits.length > 0 && (
            <div className="gps-splits">{splits.map(s => <div key={s.n}><span>{du} {s.n}</span><b>{fmtDuration(s.seconds)}</b></div>)}</div>
          )}
        </div>
      )}
      {!finished && block.activity.hasDistance && !c.done && (
        <button className="add-set-btn" onClick={() => setGps(true)}><Icon name="gps" size={14} /> Track with GPS</button>
      )}

      {menu && <Sheet title={block.activity.name} onClose={() => setMenu(false)} actions={[
        { label: "Move up", onClick: async () => onSession(await api(`/api/blocks/${block.id}`, { method: "PATCH", body: { move: "up" } })) },
        { label: "Move down", onClick: async () => onSession(await api(`/api/blocks/${block.id}`, { method: "PATCH", body: { move: "down" } })) },
        { label: "Clear GPS route", hidden: !c.route, onClick: () => save({ route: null }) },
        { label: "Remove", danger: true, onClick: async () => onSession(await api(`/api/blocks/${block.id}`, { method: "DELETE" })) },
      ]} />}

      {gps && <GpsTracker title={block.activity.name} onCancel={() => setGps(false)} onFinish={async r => {
        setGps(false);
        await save({ durationS: r.durationS, distanceM: r.distanceM, elevationM: r.elevationM, route: r.route.length > 1 ? r.route : null, done: true });
      }} />}
    </div>
  );
}
