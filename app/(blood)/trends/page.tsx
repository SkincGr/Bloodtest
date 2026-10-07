import Link from "next/link";
import { prisma } from "@/lib/db";
import { evaluate } from "@/lib/range";
import { relatedTo } from "@/lib/related";
import LineChart from "@/components/LineChart";
import PeriodPicker from "@/components/PeriodPicker";
import ViewToggle from "@/components/ViewToggle";
import ValuesGrid, { sectionsByGroup, type GridSection } from "@/components/ValuesGrid";
import { dateFilter, readPeriod } from "@/lib/period";

export const dynamic = "force-dynamic";

const iso = (d: Date) => d.toISOString().slice(0, 10);

type Item = Awaited<ReturnType<typeof prisma.bloodItem.findMany<{ include: { group: true; subgroup: true } }>>>[number];
type Test = { itemId: number; date: Date; value: number };

function ChartCard({ it, tests }: { it: Item; tests: Test[] }) {
  const pts = tests
    .filter((t) => t.itemId === it.id)
    .map((t) => ({ date: iso(t.date), value: t.value, out: evaluate(t.value, it.min, it.max, it.condition).out }));
  return (
    <div className="card">
      <h2>
        {it.name.replace(/\s*\n\s*/g, " / ")}{" "}
        {it.valueRange && <span className="muted">· όρια {it.valueRange}</span>}
      </h2>
      {pts.length === 0 ? (
        <p className="muted">Καμία τιμή στην επιλεγμένη περίοδο.</p>
      ) : (
        <LineChart points={pts} min={it.min} max={it.max} condition={it.condition} />
      )}
      <p className="muted">{pts.length} μετρήσεις</p>
    </div>
  );
}

export default async function Trends({
  searchParams,
}: {
  searchParams: Promise<{ person?: string; items?: string; related?: string; view?: string; period?: string; from?: string; to?: string }>;
}) {
  const sp = await searchParams;
  const personId = Number(sp.person);
  const { period, from, to } = readPeriod(sp);
  const itemIds = (sp.items ?? "").split(",").map(Number).filter((n) => Number.isInteger(n) && n > 0);
  // Related charts only make sense for a single exam.
  const withRelated = sp.related === "1" && itemIds.length === 1;
  const view = sp.view === "table" ? "table" : "chart";

  const person = personId ? await prisma.person.findUnique({ where: { id: personId } }) : null;
  const allItems = person
    ? await prisma.bloodItem.findMany({ include: { group: true, subgroup: true }, orderBy: [{ groupId: "asc" }, { subgroupId: "asc" }, { id: "asc" }] })
    : [];
  const items = allItems.filter((i) => itemIds.includes(i.id));
  const groups = withRelated ? relatedTo(itemIds[0], allItems) : [];
  const relatedIds = groups.flatMap((g) => g.ids);

  const tests = items.length
    ? await prisma.bloodTest.findMany({
        where: { personId, itemId: { in: [...items.map((i) => i.id), ...relatedIds] }, date: dateFilter(period, from, to) },
        orderBy: { date: "asc" },
        select: { itemId: true, date: true, value: true },
      })
    : [];
  const hasData = new Set(tests.map((t) => t.itemId));
  const byId = new Map(allItems.map((i) => [i.id, i]));

  // Query kept when changing the period (params) or the view (viewParams).
  const params: Record<string, string> = { person: String(personId), items: items.map((i) => i.id).join(",") };
  if (withRelated) params.related = "1";
  const viewParams: Record<string, string> = { ...params, period, ...(period === "custom" && from && { from }), ...(period === "custom" && to && { to }) };
  if (view === "table") params.view = "table";

  // Table view: the selected exam(s) first, then each related group (exams without values in the period are listed below).
  const tableSections: GridSection[] = withRelated
    ? [
        { title: "Επιλεγμένη εξέταση", items },
        ...groups.map((g) => ({ title: g.title, items: g.ids.filter((id) => hasData.has(id)).map((id) => byId.get(id)!) })),
      ].filter((s) => s.items.length)
    : sectionsByGroup(items);
  const emptyRelated = groups.flatMap((g) => g.ids.filter((id) => !hasData.has(id)));

  return (
    <>
      <p><Link href={`/tests?person=${personId || ""}`}>← Πίσω στο Αρχείο</Link></p>
      <div className="head">
        <h1>Ιστορικό{person ? ` — ${person.name}` : ""}</h1>
        {person && items.length > 0 && (
          <div className="row" style={{ margin: 0, gap: "8px 20px" }}>
            <ViewToggle path="/trends" params={viewParams} view={view} />
            <PeriodPicker path="/trends" params={params} period={period} from={from} to={to} />
          </div>
        )}
      </div>
      {items.length === 0 && <p className="muted">Δεν επιλέχθηκαν εξετάσεις.</p>}

      {view === "table" && items.length > 0 && (
        <>
          <ValuesGrid sections={tableSections} tests={tests} />
          {withRelated && emptyRelated.length > 0 && (
            <p className="muted small">
              Συσχετιζόμενες χωρίς μετρήσεις στην περίοδο:{" "}
              {emptyRelated.map((id) => byId.get(id)!.name.replace(/\s*\n.*$/s, "")).join(", ")}
            </p>
          )}
          {withRelated && groups.length === 0 && (
            <p className="muted">Δεν έχουν οριστεί συσχετιζόμενες εξετάσεις για αυτή την εξέταση.</p>
          )}
        </>
      )}

      {view === "chart" &&
        items.map((it) => (
          <ChartCard key={it.id} it={it} tests={tests} />
        ))}

      {view === "chart" && withRelated && (
        <section className="related">
          <h2 className="relhead">Συσχετιζόμενες εξετάσεις</h2>
          {groups.length === 0 && <p className="muted">Δεν έχουν οριστεί συσχετιζόμενες εξετάσεις για αυτή την εξέταση.</p>}
          {groups.map((g) => {
            const shown = g.ids.filter((id) => hasData.has(id));
            const empty = g.ids.filter((id) => !hasData.has(id));
            return (
              <div key={g.title}>
                <h3 className="relgroup">{g.title}</h3>
                {shown.length > 0 && (
                  <div className="chartgrid">
                    {shown.map((id) => (
                      <ChartCard key={id} it={byId.get(id)!} tests={tests} />
                    ))}
                  </div>
                )}
                {empty.length > 0 && (
                  <p className="muted small">
                    Χωρίς μετρήσεις στην περίοδο: {empty.map((id) => byId.get(id)!.name.replace(/\s*\n.*$/s, "")).join(", ")}
                  </p>
                )}
              </div>
            );
          })}
          <p className="muted small">
            Οι συσχετίσεις είναι γενικές (ποιες εξετάσεις κοιτάζονται μαζί) και ορίζονται στο lib/related.ts — δεν είναι
            διάγνωση.
          </p>
        </section>
      )}
    </>
  );
}
