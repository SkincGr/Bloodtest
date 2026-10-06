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

  const toggle = (id: number) =>
    setSelected((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

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
          onClick={() => router.push(`/trends?person=${personId}&items=${[...selected].join(",")}`)}
        >
          Ιστορικό{selected.size ? ` (${selected.size})` : ""}
        </button>
        {selected.size > 0 && (
          <button className="ghost" onClick={() => setSelected(new Set())}>Καθαρισμός</button>
        )}
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
                  <input type="checkbox" checked={allOn} aria-label={`Επιλογή όλων: ${g.name}`}
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
