"use client";
import { useMemo, useState } from "react";
import type { Repeat } from "@/lib/repeat";

export type FreqRow = {
  id: number;
  name: string;
  group: string;
  count: number;
  last: string | null; // YYYY-MM-DD
  lastValue: number | null; // value of the last measurement
  lastOut: boolean; // last value is outside the limits
  days: number | null; // days from the last measurement to today
  rep: Repeat; // when to repeat, and why
};

type Key = "name" | "count" | "lastValue" | "last" | "days" | "rep";

const COLS: { key: Key; label: string; center?: boolean }[] = [
  { key: "name", label: "Εξέταση" },
  { key: "count", label: "Μετρήσεις", center: true },
  { key: "lastValue", label: "Τελ. μέτρηση", center: true },
  { key: "last", label: "Τελευταία μέτρηση", center: true },
  { key: "days", label: "Μήνες από σήμερα", center: true },
  { key: "rep", label: "Επανάληψη" },
];

const fmt = (d: string) => d.split("-").reverse().join("/");
const monthYear = (d: string) => `${d.slice(5, 7)}/${d.slice(0, 4)}`;
const DAYS_PER_MONTH = 365.25 / 12; // average month length; rows still sort by the exact day count
const RANK = { due: 0, soon: 1, ok: 2, none: 3 } as const;

// "due" first (most overdue on top), then "soon" / "ok" by the nearest due date.
function compareRep(a: Repeat, b: Repeat) {
  if (RANK[a.status] !== RANK[b.status]) return RANK[a.status] - RANK[b.status];
  if (a.status === "due") return (b.overdueDays ?? 0) - (a.overdueDays ?? 0);
  return (a.dueDate ?? "").localeCompare(b.dueDate ?? "");
}

function RepeatCell({ rep }: { rep: Repeat }) {
  if (rep.status === "none") return <span className="muted">—</span>;
  const label =
    rep.status === "due"
      ? `Να γίνει (καθυστέρηση ${((rep.overdueDays ?? 0) / DAYS_PER_MONTH).toFixed(1)} μήνες)`
      : rep.status === "soon"
        ? `Σύντομα (έως ${monthYear(rep.dueDate!)})`
        : `OK (έως ${monthYear(rep.dueDate!)})`;
  return (
    <>
      <span className={`st ${rep.status}`}>{label}</span>
      <div className="muted small">{rep.reason}</div>
    </>
  );
}

export default function FrequencyTable({ rows }: { rows: FreqRow[] }) {
  // Default: what has to be done first.
  const [sort, setSort] = useState<{ key: Key; dir: 1 | -1 }>({ key: "rep", dir: 1 });

  const sorted = useMemo(() => {
    const { key, dir } = sort;
    const never = (r: FreqRow) => r.count === 0;
    return [...rows].sort((a, b) => {
      // exams never measured always go last, whichever way we sort (except by name / count)
      if (key !== "name" && key !== "count" && never(a) !== never(b)) return never(a) ? 1 : -1;
      let c = 0;
      if (key === "name") c = a.name.localeCompare(b.name, "el");
      else if (key === "count") c = a.count - b.count;
      else if (key === "lastValue") c = (a.lastValue ?? 0) - (b.lastValue ?? 0);
      else if (key === "last") c = (a.last ?? "").localeCompare(b.last ?? "");
      else if (key === "days") c = (a.days ?? 0) - (b.days ?? 0);
      else c = compareRep(a.rep, b.rep);
      return c * dir || a.name.localeCompare(b.name, "el");
    });
  }, [rows, sort]);

  const click = (key: Key) =>
    setSort((s) =>
      s.key === key ? { key, dir: (s.dir * -1) as 1 | -1 } : { key, dir: key === "name" || key === "rep" ? 1 : -1 },
    );

  return (
    <div className="card gridwrap">
      <table className="grid">
        <thead>
          <tr>
            {COLS.map((c) => (
              <th key={c.key} className={c.center ? "c" : ""}
                aria-sort={sort.key === c.key ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
                <button className="sortbtn" onClick={() => click(c.key)} title="Ταξινόμηση">
                  {c.label}{" "}
                  <span className={"arrow" + (sort.key === c.key ? " on" : "")}>
                    {sort.key === c.key ? (sort.dir === 1 ? "▲" : "▼") : "⇅"}
                  </span>
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.id} className={r.count === 0 ? "never" : r.rep.status === "due" ? "isdue" : ""}>
              <td>
                {r.name.replace(/\s*\n\s*/g, " / ")}
                <div className="muted small">{r.group}</div>
              </td>
              <td className="c">{r.count}</td>
              <td className={r.lastOut ? "c bad" : "c"}>{r.lastValue ?? "—"}</td>
              <td className="c">{r.last ? fmt(r.last) : "—"}</td>
              <td className="c" title={r.days != null ? `${r.days} ημέρες` : undefined}>
                {r.days != null ? (r.days / DAYS_PER_MONTH).toFixed(1) : "—"}
              </td>
              <td className="rep">
                <RepeatCell rep={r.rep} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
