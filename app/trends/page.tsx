import Link from "next/link";
import { prisma } from "@/lib/db";
import { evaluate } from "@/lib/range";
import LineChart from "@/components/LineChart";

export const dynamic = "force-dynamic";

const iso = (d: Date) => d.toISOString().slice(0, 10);

export default async function Trends({
  searchParams,
}: {
  searchParams: Promise<{ person?: string; items?: string }>;
}) {
  const sp = await searchParams;
  const personId = Number(sp.person);
  const itemIds = (sp.items ?? "").split(",").map(Number).filter((n) => Number.isInteger(n) && n > 0);

  const person = personId ? await prisma.person.findUnique({ where: { id: personId } }) : null;
  const items = person && itemIds.length
    ? await prisma.bloodItem.findMany({ where: { id: { in: itemIds } }, include: { group: true }, orderBy: [{ groupId: "asc" }, { id: "asc" }] })
    : [];
  const tests = items.length
    ? await prisma.bloodTest.findMany({
        where: { personId, itemId: { in: items.map((i) => i.id) } },
        orderBy: { date: "asc" },
      })
    : [];

  return (
    <>
      <p><Link href={`/tests?person=${personId || ""}`}>← Πίσω στα αποτελέσματα</Link></p>
      <h1>Ιστορικό{person ? ` — ${person.name}` : ""}</h1>
      {items.length === 0 && <p className="muted">Δεν επιλέχθηκαν εξετάσεις.</p>}
      {items.map((it) => {
        const pts = tests
          .filter((t) => t.itemId === it.id)
          .map((t) => ({
            date: iso(t.date),
            value: t.value,
            out: evaluate(t.value, it.min, it.max, it.condition).out,
          }));
        return (
          <div className="card" key={it.id}>
            <h2>
              {it.name}{" "}
              {it.valueRange && <span className="muted">· όρια {it.valueRange}</span>}
            </h2>
            {pts.length === 0 ? (
              <p className="muted">Καμία τιμή.</p>
            ) : (
              <LineChart points={pts} min={it.min} max={it.max} condition={it.condition} />
            )}
            <p className="muted">{pts.length} μετρήσεις</p>
          </div>
        );
      })}
    </>
  );
}
