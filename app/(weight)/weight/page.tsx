import { prisma } from "@/lib/db";
import { dateFilter, readPeriod } from "@/lib/period";
import { aggregate, UNITS } from "@/lib/weightUnit";
import LineChart from "@/components/LineChart";
import WeightFilters from "@/components/WeightFilters";

export const dynamic = "force-dynamic";

export default async function Weight({
  searchParams,
}: {
  searchParams: Promise<{ height?: string; period?: string; from?: string; to?: string; unit?: string }>;
}) {
  const sp = await searchParams;
  // Persons that have a height; it links them to their rows in Weight.
  const persons = (await prisma.person.findMany({ where: { height: { not: null } }, orderBy: { id: "asc" } })).map(
    (p) => ({ name: p.name, height: p.height! }),
  );
  const height = persons.find((p) => p.height === Number(sp.height))?.height ?? persons[0]?.height;
  // Defaults: last year, averaged per week.
  const { period, from, to } = readPeriod({ ...sp, period: sp.period ?? "1y" });
  const unit = sp.unit && sp.unit in UNITS ? sp.unit : "week";

  const rows = height
    ? await prisma.weight.findMany({ where: { height, date: dateFilter(period, from, to) }, orderBy: { date: "asc" } })
    : [];
  const points = aggregate(rows.map((r) => ({ date: r.date.toISOString().slice(0, 10), weight: r.weight })), unit);

  return (
    <>
      <div className="head">
        <h1>Βάρος</h1>
        <WeightFilters persons={persons} height={height} period={period} from={from} to={to} unit={unit} />
      </div>
      {points.length === 0 ? (
        <p className="muted">Καμία μέτρηση στην επιλεγμένη περίοδο.</p>
      ) : (
        <div className="card">
          <p className="muted small">
            {rows.length} μετρήσεις · {points.length} σημεία (μέσος όρος ανά {UNITS[unit].toLowerCase()})
          </p>
          <LineChart points={points} min={null} max={null} condition={null} />
        </div>
      )}
    </>
  );
}
