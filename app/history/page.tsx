import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// Min/Max semantics come from the Access "Codition" column.
function outOfRange(v: number, min: number | null, max: number | null, cond: string | null) {
  if (cond === "Between" && min != null && max != null) return v < min || v > max;
  if (cond === "<" && max != null) return v >= max;
  if (cond === ">" && min != null) return v <= min;
  return false;
}

const day = (d: Date) => d.toISOString().slice(0, 10);

export default async function History({
  searchParams,
}: {
  searchParams: Promise<{ person?: string }>;
}) {
  const sp = await searchParams;
  const persons = await prisma.person.findMany({ orderBy: { id: "asc" } });
  const personId = Number(sp.person) || persons[0]?.id;
  const tests = personId
    ? await prisma.bloodTest.findMany({ where: { personId }, orderBy: { date: "desc" } })
    : [];
  const dates = [...new Set(tests.map((t) => day(t.date)))];
  const itemIds = new Set(tests.map((t) => t.itemId));
  const items = (
    await prisma.bloodItem.findMany({
      include: { group: true },
      orderBy: [{ groupId: "asc" }, { id: "asc" }],
    })
  ).filter((i) => itemIds.has(i.id));
  const cell = new Map(tests.map((t) => [`${t.itemId}|${day(t.date)}`, t.value]));

  let lastGroup: string | undefined;
  return (
    <>
      <h1>Ιστορικό</h1>
      <form className="row">
        <select name="person" defaultValue={personId}>
          {persons.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <button type="submit">Εμφάνιση</button>
      </form>
      <div className="card tablewrap">
        {items.length === 0 ? (
          <p className="muted">Καμία εξέταση.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Εξέταση</th>
                <th>Φυσιολογικό</th>
                {dates.map((d) => <th key={d} className="num">{d}</th>)}
              </tr>
            </thead>
            <tbody>
              {items.map((it) => {
                const g = it.group?.name ?? "Άλλα";
                const head = g !== lastGroup;
                lastGroup = g;
                return [
                  head && (
                    <tr className="group" key={`g${it.id}`}>
                      <td colSpan={dates.length + 2}>{g}</td>
                    </tr>
                  ),
                  <tr key={it.id}>
                    <td>{it.name}</td>
                    <td className="muted">{it.valueRange}</td>
                    {dates.map((d) => {
                      const v = cell.get(`${it.id}|${d}`);
                      const bad = v != null && outOfRange(v, it.min, it.max, it.condition);
                      return <td key={d} className={"num" + (bad ? " out" : "")}>{v ?? ""}</td>;
                    })}
                  </tr>,
                ];
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
