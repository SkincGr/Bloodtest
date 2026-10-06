"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export type ResultRow = {
  itemId: number;
  name: string;
  value: number;
  range: string;
  out: boolean;
  pct: string; // formatted, e.g. "+50%"; empty when in range
};
export type ResultGroup = { name: string; rows: ResultRow[] };

export default function ResultsTable({
  personId,
  groups,
}: {
  personId: number;
  groups: ResultGroup[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  // "Εμφάνιση συσχετιζόμενων": exactly one exam, and the history page adds the charts of its related exams.
  const [related, setRelated] = useState(false);

  const toggle = (id: number) =>
    setSelected((s) => {
      if (related) return s.has(id) ? new Set() : new Set([id]); // one at a time
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const switchRelated = (on: boolean) => {
    setRelated(on);
    if (on) setSelected((s) => new Set([...s].slice(0, 1))); // keep only the first selected exam
  };

  const toggleGroup = (g: ResultGroup, on: boolean) =>
    setSelected((s) => {
      const n = new Set(s);
      g.rows.forEach((r) => (on ? n.add(r.itemId) : n.delete(r.itemId)));
      return n;
    });

  return (
    <>
      <div className="row">
        <button
          disabled={selected.size === 0}
          onClick={() =>
            router.push(`/trends?person=${personId}&items=${[...selected].join(",")}${related ? "&related=1" : ""}`)
          }
        >
          Ιστορικό{selected.size ? ` (${selected.size})` : ""}
        </button>
        <label className="relchk" title="Επιλέγεις μία εξέταση· στο Ιστορικό εμφανίζονται και τα γραφήματα των σχετικών της">
          <input type="checkbox" checked={related} onChange={(e) => switchRelated(e.target.checked)} />
          Εμφάνιση συσχετιζόμενων
        </label>
        {selected.size > 0 && (
          <button className="ghost" onClick={() => setSelected(new Set())}>Καθαρισμός</button>
        )}
        {related && <span className="muted small">επίλεξε μία εξέταση</span>}
      </div>
      <table>
        <thead>
          <tr>
            <th></th>
            <th>Εξέταση</th>
            <th className="num">Τιμή</th>
            <th>Όρια</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => {
            const allOn = g.rows.every((r) => selected.has(r.itemId));
            return [
              <tr className="group" key={`g-${g.name}`}>
                <td>
                  <input type="checkbox" checked={!related && allOn} disabled={related} aria-label={`Επιλογή όλων: ${g.name}`}
                    onChange={(e) => toggleGroup(g, e.target.checked)} />
                </td>
                <td colSpan={3}>{g.name}</td>
              </tr>,
              ...g.rows.map((r) => (
                <tr key={r.itemId}>
                  <td>
                    <input type="checkbox" checked={selected.has(r.itemId)} onChange={() => toggle(r.itemId)} />
                  </td>
                  <td>{r.name}</td>
                  <td className={"num" + (r.out ? " bad" : "")}>
                    {r.value}
                    {r.out && r.pct && ` (${r.pct})`}
                  </td>
                  <td className="muted">{r.range}</td>
                </tr>
              )),
            ];
          })}
        </tbody>
      </table>
    </>
  );
}
