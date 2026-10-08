"use client";
import { useRouter } from "next/navigation";
import { PERIODS } from "@/lib/period";
import { UNITS } from "@/lib/weightUnit";

// Height / period / display-unit dropdowns of the weight page. Any change reloads /weight with the new query.
export default function WeightFilters({
  persons,
  height,
  period,
  from,
  to,
  unit,
  view,
}: {
  persons: { name: string; height: number }[];
  height?: number;
  period: string;
  from: string;
  to: string;
  unit: string;
  view: string;
}) {
  const router = useRouter();
  const go = (p: { height?: number; period?: string; from?: string; to?: string; unit?: string; view?: string }) => {
    const per = p.period ?? period;
    const q = new URLSearchParams({ height: String(p.height ?? height), period: per, unit: p.unit ?? unit, view: p.view ?? view });
    if (per === "custom") {
      const f = p.from ?? from;
      const t = p.to ?? to;
      if (f) q.set("from", f);
      if (t) q.set("to", t);
    }
    router.push(`/weight?${q}`);
  };

  return (
    <>
      <h1>
        Βάρος{" "}
        <span role="radiogroup" aria-label="Μορφή" style={{ fontSize: 15, fontWeight: 400 }}>
          (
          {[["table", "Σε πίνακα"], ["chart", "Σε γράφημα"]].map(([k, label], n) => (
            <label key={k} style={{ marginLeft: n ? 12 : 0 }}>
              <input type="radio" name="view" checked={view === k} onChange={() => go({ view: k })} /> {label}
            </label>
          ))}
          )
        </span>
      </h1>
      <div className="row" style={{ margin: 0 }}>
      <label className="muted">
        Πρόσωπο{" "}
        <select value={height} onChange={(e) => go({ height: Number(e.target.value) })}>
          {persons.map((p) => (
            <option key={p.height} value={p.height}>{p.name}</option>
          ))}
        </select>
      </label>
      <label className="muted">
        Περίοδος{" "}
        <select value={period} onChange={(e) => go({ period: e.target.value })}>
          {Object.entries(PERIODS).map(([k, label]) => (
            <option key={k} value={k}>{label}</option>
          ))}
        </select>
      </label>
      {period === "custom" && (
        <>
          <label className="muted">Από{" "}
            <input type="date" defaultValue={from} max={to || undefined} onChange={(e) => go({ from: e.target.value })} />
          </label>
          <label className="muted">Έως{" "}
            <input type="date" defaultValue={to} min={from || undefined} onChange={(e) => go({ to: e.target.value })} />
          </label>
        </>
      )}
      <label className="muted">
        Μονάδα εμφάνισης{" "}
        <select value={unit} onChange={(e) => go({ unit: e.target.value })}>
          {Object.entries(UNITS).map(([k, label]) => (
            <option key={k} value={k}>{label}</option>
          ))}
        </select>
      </label>
      </div>
    </>
  );
}
