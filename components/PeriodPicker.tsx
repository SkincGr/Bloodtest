"use client";
import { useRouter } from "next/navigation";
import { PERIODS } from "@/lib/period";

// Period dropdown (and optional person dropdown). Changing anything reloads `path` with the new query,
// keeping the other `params` (e.g. the selected exams on the trends page).
export default function PeriodPicker({
  path,
  params = {},
  period,
  from,
  to,
  persons,
  person,
}: {
  path: string;
  params?: Record<string, string>;
  period: string;
  from: string;
  to: string;
  persons?: { id: number; name: string }[];
  person?: number;
}) {
  const router = useRouter();
  const go = (p: { period?: string; from?: string; to?: string; person?: number }) => {
    const per = p.period ?? period;
    const q = new URLSearchParams(params);
    const who = p.person ?? person;
    if (who) q.set("person", String(who));
    q.set("period", per);
    if (per === "custom") {
      const f = p.from ?? from;
      const t = p.to ?? to;
      if (f) q.set("from", f);
      if (t) q.set("to", t);
    }
    router.push(`${path}?${q}`);
  };

  return (
    <div className="row" style={{ margin: 0 }}>
      {persons && (
        <label className="muted">
          Πρόσωπο{" "}
          <select value={person} onChange={(e) => go({ person: Number(e.target.value) })}>
            {persons.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </label>
      )}
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
    </div>
  );
}
