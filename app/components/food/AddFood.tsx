"use client";

import { useEffect, useRef, useState } from "react";
import Icon from "@/app/components/Icon";
import Modal from "@/app/components/Modal";
import BarcodeScanner from "./BarcodeScanner";
import { api, parseNum } from "@/lib/client";
import type { FoodDTO, FoundFood, Meal } from "@/lib/types";

export const MEAL_LABEL: Record<Meal, string> = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snack: "Snacks" };
const MEALS: Meal[] = ["breakfast", "lunch", "dinner", "snack"];

type Tab = "search" | "scan" | "recent" | "create" | "quick";

/** Per-serving numbers scaled to an amount. */
export function scaled(f: { kcal: number; proteinG: number | null; carbsG: number | null; fatG: number | null; servingG: number | null }, amount: number, unit: string) {
  const servings = unit === "serving" ? amount : f.servingG ? amount / f.servingG : 0;
  const r = (v: number | null) => (v == null ? null : Math.round(v * servings * 10) / 10);
  return { kcal: Math.round(f.kcal * servings), proteinG: r(f.proteinG), carbsG: r(f.carbsG), fatG: r(f.fatG) };
}

export const macroLine = (f: { proteinG: number | null; carbsG: number | null; fatG: number | null }) =>
  [f.proteinG != null && `P ${f.proteinG}g`, f.carbsG != null && `C ${f.carbsG}g`, f.fatG != null && `F ${f.fatG}g`].filter(Boolean).join(" · ");

export default function AddFood({ day, meal: initialMeal, onClose, onAdded }: {
  day: string; meal: Meal; onClose: () => void; onAdded: () => void;
}) {
  const [tab, setTab] = useState<Tab>("search");
  const [meal, setMeal] = useState<Meal>(initialMeal);
  const [picked, setPicked] = useState<FoundFood | null>(null);
  const [createFor, setCreateFor] = useState<string | null>(null); // barcode nobody knows yet
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function scanned(code: string) {
    setBusy(true); setErr("");
    try {
      const r = await api<{ food: FoodDTO | null; found: boolean }>(`/api/food/barcode/${code}`);
      if (r.food) setPicked(r.food);
      else { setCreateFor(code); setTab("create"); setErr(`Barcode ${code} isn't in the food database. Add it below and it'll be found next time.`); }
    } catch (e) { setErr((e as Error).message); setTab("search"); }
    finally { setBusy(false); }
  }

  if (picked) {
    return <AmountStep food={picked} day={day} meal={meal} setMeal={setMeal} onBack={() => setPicked(null)} onClose={onClose} onAdded={onAdded} />;
  }

  return (
    <Modal title={`Add to ${MEAL_LABEL[meal]}`} onClose={onClose} wide>
      <div className="tabs food-tabs" role="tablist">
        {([["search", "Search"], ["scan", "Scan"], ["recent", "My foods"], ["create", "New"], ["quick", "Quick"]] as [Tab, string][]).map(([t, l]) => (
          <button key={t} role="tab" aria-selected={tab === t} className={`tab ${tab === t ? "active" : ""}`} onClick={() => { setTab(t); setErr(""); }}>{l}</button>
        ))}
      </div>
      {err && <p className={createFor ? "form-hint food-notice" : "form-error"} style={{ marginBottom: 10 }}>{err}</p>}
      {busy && <div className="loading">Looking it up…</div>}
      {!busy && tab === "search" && <SearchTab onPick={setPicked} />}
      {!busy && tab === "scan" && <BarcodeScanner onCode={scanned} />}
      {!busy && tab === "recent" && <RecentTab onPick={setPicked} />}
      {!busy && tab === "create" && <CreateFood barcode={createFor} onSaved={f => { setCreateFor(null); setErr(""); setPicked(f); }} />}
      {!busy && tab === "quick" && <QuickAdd day={day} meal={meal} setMeal={setMeal} onAdded={onAdded} />}
    </Modal>
  );
}

function FoodRow({ f, onPick }: { f: FoundFood; onPick: (f: FoundFood) => void }) {
  return (
    <button className="row-card food-row" onClick={() => onPick(f)}>
      <div className="food-row-main">
        <div className="row-title">{f.name}</div>
        <div className="row-sub">{[f.brand, f.servingLabel, macroLine(f)].filter(Boolean).join(" · ")}</div>
      </div>
      <div className="food-kcal">{f.kcal}<small>kcal</small></div>
    </button>
  );
}

function SearchTab({ onPick }: { onPick: (f: FoundFood) => void }) {
  const [q, setQ] = useState("");
  const [res, setRes] = useState<{ mine: FoodDTO[]; online: FoundFood[]; onlineError: string | null } | null>(null);
  const [loading, setLoading] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setRes(null); return; }
    const n = ++seq.current;
    // Waits for a pause in typing: the online database asks apps to keep searches down.
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await api<{ mine: FoodDTO[]; online: FoundFood[]; onlineError: string | null }>(`/api/food/search?q=${encodeURIComponent(term)}`);
        if (n === seq.current) setRes(r);
      } catch (e) { if (n === seq.current) setRes({ mine: [], online: [], onlineError: (e as Error).message }); }
      finally { if (n === seq.current) setLoading(false); }
    }, 600);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div>
      <input className="form-input" autoFocus placeholder="Search foods, like greek yogurt or a brand" value={q} onChange={e => setQ(e.target.value)} aria-label="Search foods" />
      {loading && <div className="loading">Searching…</div>}
      {res && !loading && (
        <div className="food-results">
          {res.mine.length > 0 && <><div className="section-label">My foods</div>{res.mine.map(f => <FoodRow key={`m${f.id}`} f={f} onPick={onPick} />)}</>}
          {res.online.length > 0 && <><div className="section-label">Open Food Facts</div>{res.online.map(f => <FoodRow key={`o${f.barcode}`} f={f} onPick={onPick} />)}</>}
          {res.onlineError && <p className="form-hint">{res.onlineError}</p>}
          {!res.mine.length && !res.online.length && !res.onlineError && <p className="form-hint">Nothing found. Try fewer words, scan the barcode, or add it as a new food.</p>}
        </div>
      )}
      <p className="form-hint" style={{ marginTop: 10 }}>Packaged foods come from Open Food Facts, a free database anyone can add to. Numbers can be off, so check them against the label.</p>
    </div>
  );
}

function RecentTab({ onPick }: { onPick: (f: FoundFood) => void }) {
  const [foods, setFoods] = useState<FoodDTO[] | null>(null);
  const [q, setQ] = useState("");
  useEffect(() => {
    const t = setTimeout(() => { api<FoodDTO[]>(`/api/food/foods${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ""}`).then(setFoods).catch(() => setFoods([])); }, 250);
    return () => clearTimeout(t);
  }, [q]);
  return (
    <div>
      <input className="form-input" placeholder="Filter my foods" value={q} onChange={e => setQ(e.target.value)} aria-label="Filter my foods" />
      {!foods ? <div className="loading">Loading…</div> : foods.length === 0
        ? <p className="form-hint" style={{ marginTop: 10 }}>{q ? "No match." : "Foods you scan, search or create show up here, most recent first."}</p>
        : <div className="food-results">{foods.map(f => <FoodRow key={f.id} f={f} onPick={onPick} />)}</div>}
    </div>
  );
}

export function CreateFood({ barcode, food, onSaved }: { barcode?: string | null; food?: FoodDTO; onSaved: (f: FoodDTO) => void }) {
  const [f, setF] = useState({
    name: food?.name ?? "", brand: food?.brand ?? "", servingLabel: food?.servingLabel ?? "",
    servingG: food?.servingG != null ? String(food.servingG) : "", unit: food?.unit ?? "g",
    kcal: food ? String(food.kcal) : "", proteinG: food?.proteinG != null ? String(food.proteinG) : "",
    carbsG: food?.carbsG != null ? String(food.carbsG) : "", fatG: food?.fatG != null ? String(food.fatG) : "",
  });
  const [err, setErr] = useState("");
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF(x => ({ ...x, [k]: e.target.value }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (parseNum(f.kcal) == null) return setErr("Enter the calories per serving");
    const body = {
      name: f.name, brand: f.brand || null, servingLabel: f.servingLabel || null, servingG: parseNum(f.servingG), unit: f.unit,
      kcal: parseNum(f.kcal), proteinG: parseNum(f.proteinG), carbsG: parseNum(f.carbsG), fatG: parseNum(f.fatG),
      barcode: food?.barcode ?? barcode ?? null, source: food?.source ?? "custom",
    };
    try { onSaved(await api<FoodDTO>(food ? `/api/food/foods/${food.id}` : "/api/food/foods", { method: food ? "PATCH" : "POST", body })); }
    catch (x) { setErr((x as Error).message); }
  }

  return (
    <form className="form-stack" onSubmit={save}>
      {err && <p className="form-error">{err}</p>}
      <div className="form-group"><label className="form-label">Name</label><input className="form-input" required value={f.name} onChange={set("name")} placeholder="Chicken burrito" /></div>
      <div className="form-group"><label className="form-label">Brand <span className="text-muted">(optional)</span></label><input className="form-input" value={f.brand} onChange={set("brand")} /></div>
      <div className="form-grid-2">
        <div className="form-group"><label className="form-label">Serving</label><input className="form-input" value={f.servingLabel} onChange={set("servingLabel")} placeholder="1 cup" /></div>
        <div className="form-group">
          <label className="form-label">Serving size <span className="text-muted">(optional)</span></label>
          <div className="input-unit">
            <input className="form-input" inputMode="decimal" value={f.servingG} onChange={set("servingG")} placeholder="240" />
            <select className="form-select" value={f.unit} onChange={set("unit")} aria-label="Serving unit"><option value="g">g</option><option value="ml">ml</option></select>
          </div>
        </div>
      </div>
      <p className="form-hint" style={{ marginTop: -6 }}>Numbers below are for one serving, as printed on the label. With a serving size you can also log it by weight.</p>
      <div className="form-grid-2">
        <div className="form-group"><label className="form-label">Calories</label><input className="form-input" inputMode="decimal" required value={f.kcal} onChange={set("kcal")} /></div>
        <div className="form-group"><label className="form-label">Protein (g)</label><input className="form-input" inputMode="decimal" value={f.proteinG} onChange={set("proteinG")} /></div>
        <div className="form-group"><label className="form-label">Carbs (g)</label><input className="form-input" inputMode="decimal" value={f.carbsG} onChange={set("carbsG")} /></div>
        <div className="form-group"><label className="form-label">Fat (g)</label><input className="form-input" inputMode="decimal" value={f.fatG} onChange={set("fatG")} /></div>
      </div>
      {(food?.barcode || barcode) && <p className="form-hint">Barcode {food?.barcode ?? barcode}</p>}
      <button className="btn-primary">{food ? "Save food" : "Save and continue"}</button>
    </form>
  );
}

function QuickAdd({ day, meal, setMeal, onAdded }: { day: string; meal: Meal; setMeal: (m: Meal) => void; onAdded: () => void }) {
  const [f, setF] = useState({ name: "", kcal: "", proteinG: "", carbsG: "", fatG: "" });
  const [err, setErr] = useState("");
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF(x => ({ ...x, [k]: e.target.value }));
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (parseNum(f.kcal) == null) return setErr("Enter the calories");
    try {
      await api("/api/food/entries", { body: { day, meal, name: f.name || null, kcal: parseNum(f.kcal), proteinG: parseNum(f.proteinG), carbsG: parseNum(f.carbsG), fatG: parseNum(f.fatG) } });
      onAdded();
    } catch (x) { setErr((x as Error).message); }
  }
  return (
    <form className="form-stack" onSubmit={save}>
      <p className="form-hint">For when you just know the numbers, like a restaurant meal. It isn&apos;t saved as a food.</p>
      {err && <p className="form-error">{err}</p>}
      <div className="form-group"><label className="form-label">What was it <span className="text-muted">(optional)</span></label><input className="form-input" value={f.name} onChange={set("name")} /></div>
      <div className="form-grid-2">
        <div className="form-group"><label className="form-label">Calories</label><input className="form-input" inputMode="decimal" required value={f.kcal} onChange={set("kcal")} /></div>
        <div className="form-group"><label className="form-label">Protein (g)</label><input className="form-input" inputMode="decimal" value={f.proteinG} onChange={set("proteinG")} /></div>
        <div className="form-group"><label className="form-label">Carbs (g)</label><input className="form-input" inputMode="decimal" value={f.carbsG} onChange={set("carbsG")} /></div>
        <div className="form-group"><label className="form-label">Fat (g)</label><input className="form-input" inputMode="decimal" value={f.fatG} onChange={set("fatG")} /></div>
      </div>
      <MealPicker meal={meal} setMeal={setMeal} />
      <button className="btn-primary">Add</button>
    </form>
  );
}

export function MealPicker({ meal, setMeal }: { meal: Meal; setMeal: (m: Meal) => void }) {
  return (
    <div className="form-group">
      <label className="form-label">Meal</label>
      <div className="seg seg-full">{MEALS.map(m => <button key={m} type="button" className={meal === m ? "on" : ""} onClick={() => setMeal(m)}>{MEAL_LABEL[m]}</button>)}</div>
    </div>
  );
}

function AmountStep({ food, day, meal, setMeal, onBack, onClose, onAdded }: {
  food: FoundFood; day: string; meal: Meal; setMeal: (m: Meal) => void; onBack: () => void; onClose: () => void; onAdded: () => void;
}) {
  const [unit, setUnit] = useState<"serving" | "g" | "ml">("serving");
  const [amount, setAmount] = useState("1");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const n = parseNum(amount);
  const p = n != null && n > 0 ? scaled(food, n, unit) : null;

  function changeUnit(u: "serving" | "g" | "ml") {
    // Keep the same portion when switching between servings and grams.
    if (n != null && food.servingG) setAmount(String(u === "serving" ? Math.round((n / food.servingG) * 100) / 100 : Math.round(n * food.servingG)));
    setUnit(u);
  }

  async function add() {
    if (n == null || n <= 0) return setErr("Enter how much you had");
    setBusy(true); setErr("");
    try {
      // Online results aren't saved until you log one.
      const saved = food.id ? food : await api<FoodDTO>("/api/food/foods", { body: food });
      await api("/api/food/entries", { body: { day, meal, foodId: saved.id, amount: n, unit } });
      onAdded();
    } catch (x) { setErr((x as Error).message); setBusy(false); }
  }

  return (
    <Modal title={food.name} onClose={onClose} footer={
      <div className="flex gap-2" style={{ width: "100%" }}>
        <button className="btn-ghost" onClick={onBack}><Icon name="back" size={14} /> Back</button>
        <button className="btn-primary" style={{ flex: 1 }} disabled={busy || !p} onClick={add}>Add to {MEAL_LABEL[meal]}</button>
      </div>}>
      <p className="row-sub" style={{ marginBottom: 12 }}>{[food.brand, `${food.servingLabel}: ${food.kcal} kcal`].filter(Boolean).join(" · ")}</p>
      {err && <p className="form-error">{err}</p>}
      <div className="form-group">
        <label className="form-label">How much</label>
        <div className="input-unit">
          <input className="form-input" inputMode="decimal" autoFocus value={amount} onChange={e => setAmount(e.target.value)} aria-label="Amount" />
          <select className="form-select" value={unit} onChange={e => changeUnit(e.target.value as "serving" | "g" | "ml")} aria-label="Unit">
            <option value="serving">{n === 1 ? "serving" : "servings"}</option>
            {food.servingG && <option value={food.unit}>{food.unit}</option>}
          </select>
        </div>
        {unit === "serving" && <div className="chip-wrap" style={{ marginTop: 8 }}>{[0.5, 1, 1.5, 2].map(x => <button key={x} type="button" className={`filter-chip ${n === x ? "active" : ""}`} onClick={() => setAmount(String(x))}>{x}</button>)}</div>}
      </div>
      <MealPicker meal={meal} setMeal={setMeal} />
      {p && (
        <div className="food-preview">
          <div><b>{p.kcal}</b><span>kcal</span></div>
          <div><b>{p.proteinG ?? "–"}</b><span>protein g</span></div>
          <div><b>{p.carbsG ?? "–"}</b><span>carbs g</span></div>
          <div><b>{p.fatG ?? "–"}</b><span>fat g</span></div>
        </div>
      )}
    </Modal>
  );
}
