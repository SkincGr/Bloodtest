import Link from "next/link";
import { prisma } from "@/lib/db";
import { evaluate, formatPct } from "@/lib/range";
import ResultsTable from "@/components/ResultsTable";

export const dynamic = "force-dynamic";

const iso = (d: Date) => d.toISOString().slice(0, 10);
const greek = (s: string) => s.split("-").reverse().join("/");

export default async function Tests({
  searchParams,
}: {
  searchParams: Promise<{ person?: string; date?: string }>;
}) {
  const sp = await searchParams;
  const persons = await prisma.person.findMany({ orderBy: { id: "asc" } });
  const personId = Number(sp.person) || persons[0]?.id;

  const perDate = personId
    ? await prisma.bloodTest.groupBy({
        by: ["date"],
        where: { personId },
        _count: { _all: true },
        orderBy: { date: "desc" },
      })
    : [];
  const dates = perDate.map((d) => ({ date: iso(d.date), count: d._count._all }));
  const selected = dates.find((d) => d.date === sp.date)?.date ?? dates[0]?.date;

  const rows = selected
    ? await prisma.bloodTest.findMany({
        where: { personId, date: new Date(selected) },
        include: { item: { include: { group: true } } },
        orderBy: [{ item: { groupId: "asc" } }, { itemId: "asc" }],
      })
    : [];

  const groups: { name: string; rows: typeof rows }[] = [];
  for (const r of rows) {
    const name = r.item.group?.name ?? "Άλλα";
    const last = groups[groups.length - 1];
    if (last?.name === name) last.rows.push(r);
    else groups.push({ name, rows: [r] });
  }
  const outCount = rows.filter((r) => evaluate(r.value, r.item.min, r.item.max, r.item.condition).out).length;

  return (
    <>
      <h1>Αποτελέσματα</h1>
      <form className="row">
        <select name="person" defaultValue={personId}>
          {persons.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <button type="submit">Εμφάνιση</button>
      </form>

      {dates.length === 0 ? (
        <p className="muted">Δεν υπάρχουν εξετάσεις για αυτό το πρόσωπο.</p>
      ) : (
        <div className="split">
          <aside className="card dates">
            {dates.map((d) => (
              <Link
                key={d.date}
                href={`/tests?person=${personId}&date=${d.date}`}
                className={d.date === selected ? "active" : ""}
              >
                {greek(d.date)} <span className="muted">({d.count})</span>
              </Link>
            ))}
          </aside>

          <section className="card tablewrap">
            <h2>
              {greek(selected!)}{" "}
              <span className={outCount ? "bad" : "ok"}>
                {outCount ? `${outCount} εκτός ορίων` : "όλα εντός ορίων"}
              </span>
            </h2>
            <ResultsTable
              personId={personId!}
              groups={groups.map((g) => ({
                name: g.name,
                rows: g.rows.map((r) => {
                  const res = evaluate(r.value, r.item.min, r.item.max, r.item.condition);
                  return {
                    itemId: r.itemId,
                    name: r.item.name,
                    value: r.value,
                    range: r.item.valueRange ?? "",
                    out: res.out,
                    pct: formatPct(res.pct),
                  };
                }),
              }))}
            />
          </section>
        </div>
      )}
    </>
  );
}
