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
}: {
  persons: { name: string; height: number }[];
  height?: number;
  period: string;
  from: string;
  to: string;
  unit: string;
}) {
  const router = useRouter();
  const go = (p: { height?: number; period?: string; from?: string; to?: string; unit?: string }) => {
    const per = p.period ?? period;
    const q = new URLSearchParams({ height: String(p.height ?? height), period: per, unit: p.unit ?? unit });
    if (per === "custom") {
      const f = p.from ?? from;
      const t = p.to ?? to;
      if (f) q.set("from", f);
      if (t) q.set("to", t);
    }
    router.push(`/weight?${q}`);
  };

  return (
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
  );
}
