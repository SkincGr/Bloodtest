import { evaluate, formatPct } from "@/lib/range";

// Exams x dates table (newest date first) with a fixed header row and first column.
// Out-of-range values are bold red; hovering one shows its limits and deviation.
// Used by "Πίνακας" and by the table view of "Ιστορικό".
export type GridItem = {
  id: number;
  name: string;
  valueRange: string | null;
  min: number | null;
  max: number | null;
  condition: string | null;
};
export type GridTest = { itemId: number; date: Date; value: number };
export type GridSection = { title: string; sub?: string; items: GridItem[] };

const day = (d: Date) => d.toISOString().slice(0, 10);

export default function ValuesGrid({ sections, tests }: { sections: GridSection[]; tests: GridTest[] }) {
  const ids = new Set(sections.flatMap((s) => s.items.map((i) => i.id)));
  const own = tests.filter((t) => ids.has(t.itemId));
  const dates = [...new Set(own.map((t) => day(t.date)))].sort().reverse();
  const cell = new Map(own.map((t) => [`${t.itemId}|${day(t.date)}`, t.value]));

  if (!sections.some((s) => s.items.length) || !dates.length)
    return (
      <div className="card">
        <p className="muted">Καμία τιμή.</p>
      </div>
    );

  return (
    <div className="card gridwrap">
      <table className="grid">
        <thead>
          <tr>
            <th>Εξέταση</th>
            {dates.map((d) => (
              <th key={d} className="num">{d}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sections.map((s, n) => [
            s.title && s.title !== sections[n - 1]?.title && (
              <tr className="group" key={`g-${s.title}`}>
                <td colSpan={dates.length + 1}>
                  <span className="gname">{s.title}</span>
                </td>
              </tr>
            ),
            s.sub && (
              <tr className="subgroup" key={`s-${s.title}-${s.sub}`}>
                <td colSpan={dates.length + 1}>{s.sub}</td>
              </tr>
            ),
            ...s.items.map((it) => (
              <tr key={`${s.title}-${it.id}`}>
                <td>{it.name.replace(/\s*\n\s*/g, " / ")}</td>
                {dates.map((d) => {
                  const v = cell.get(`${it.id}|${d}`);
                  const r = v != null ? evaluate(v, it.min, it.max, it.condition) : null;
                  const bad = !!r?.out;
                  return (
                    <td key={d} className={"num" + (bad ? " out" : "")}>
                      {v ?? ""}
                      {bad && (
                        <span className="lim">
                          {it.valueRange && <>όρια {it.valueRange}</>}
                          {r?.pct != null && <b className="dev"> · απόκλιση {formatPct(r.pct)}</b>}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            )),
          ])}
        </tbody>
      </table>
    </div>
  );
}

// Groups items into sections by their BloodItem group and subgroup (items must already be ordered by group, subgroup).
export function sectionsByGroup<
  T extends GridItem & { group: { name: string } | null; subgroup?: { name: string } | null },
>(items: T[]): GridSection[] {
  const out: GridSection[] = [];
  for (const it of items) {
    const title = it.group?.name ?? "Άλλα";
    const sub = it.subgroup?.name;
    const last = out[out.length - 1];
    if (last?.title === title && last.sub === sub) last.items.push(it);
    else out.push({ title, sub, items: [it] });
  }
  return out;
}
