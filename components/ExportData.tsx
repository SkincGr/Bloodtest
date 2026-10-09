"use client";
import { useState } from "react";
import { PERIODS } from "@/lib/period";

type Group = { id: number | null; name: string; items: { id: number; name: string }[] };

// Choose a person, a period and exams (a whole group or single exams); downloads a .txt with the measurements of
// each chosen exam in that period: ΗΜΕΡΟΜΗΝΙΑ - ΠΕΡΙΓΡΑΦΗ - ΣΥΜΒΟΛΟ - ΤΙΜΗ (see /api/export).
export default function ExportData({ persons, groups }: { persons: { id: number; name: string }[]; groups: Group[] }) {
  const [person, setPerson] = useState(persons[0]?.id ?? 0);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [period, setPeriod] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const toggle = (id: number) =>
    setSelected((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  const toggleGroup = (g: Group, on: boolean) =>
    setSelected((s) => {
      const n = new Set(s);
      g.items.forEach((i) => (on ? n.add(i.id) : n.delete(i.id)));
      return n;
    });
  const all = groups.flatMap((g) => g.items.map((i) => i.id));

  return (
    <div className="card">
      <p className="muted" style={{ marginTop: 0 }}>
        Εξάγει σε αρχείο .txt τις μετρήσεις κάθε επιλεγμένης εξέτασης στην επιλεγμένη περίοδο, σε μορφή
        ΗΜΕΡΟΜΗΝΙΑ - ΠΕΡΙΓΡΑΦΗ - ΣΥΜΒΟΛΟ - ΤΙΜΗ.
      </p>
      <div className="row">
        <select value={person} onChange={(e) => setPerson(Number(e.target.value))} aria-label="Πρόσωπο">
          {persons.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <label className="muted">
          Περίοδος{" "}
          <select value={period} onChange={(e) => setPeriod(e.target.value)}>
            {Object.entries(PERIODS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </select>
        </label>
        {period === "custom" && (
          <>
            <label className="muted">Από{" "}
              <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
            </label>
            <label className="muted">Έως{" "}
              <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
            </label>
          </>
        )}
        <button type="button" className="ghost" onClick={() => setSelected(new Set(all))}>Όλες</button>
        <button type="button" className="ghost" onClick={() => setSelected(new Set())} disabled={selected.size === 0}>Καθαρισμός</button>
        <a
          className={"btn" + (selected.size ? "" : " disabled")}
          href={selected.size ? `/api/export?person=${person}&items=${[...selected].join(",")}&period=${period}${period === "custom" ? `&from=${from}&to=${to}` : ""}` : undefined}
        >
          Export Data{selected.size ? ` (${selected.size})` : ""}
        </a>
      </div>
      {groups.map((g) => {
        const on = g.items.filter((i) => selected.has(i.id)).length;
        return (
          <details key={g.id ?? g.name} style={{ borderTop: "1px solid var(--line)", padding: "6px 0" }}>
            <summary style={{ cursor: "pointer" }}>
              <label onClick={(e) => e.stopPropagation()}>
                <input type="checkbox" checked={on === g.items.length} ref={(el) => { if (el) el.indeterminate = on > 0 && on < g.items.length; }}
                  onChange={(e) => toggleGroup(g, e.target.checked)} aria-label={`Επιλογή όλων: ${g.name}`} />{" "}
              </label>
              <strong>{g.name}</strong> <span className="muted small">({on}/{g.items.length})</span>
            </summary>
            <div style={{ paddingLeft: 24 }}>
              {g.items.map((i) => (
                <label key={i.id} style={{ display: "block" }}>
                  <input type="checkbox" checked={selected.has(i.id)} onChange={() => toggle(i.id)} />{" "}
                  {i.name.replace(/\s*\n\s*/g, " / ")}
                </label>
              ))}
            </div>
          </details>
        );
      })}
    </div>
  );
}
