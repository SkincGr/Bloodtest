import { prisma } from "@/lib/db";
import { dateFilter, readPeriod } from "@/lib/period";
import { aggregate, bucketLabel, UNITS } from "@/lib/weightUnit";
import LineChart from "@/components/LineChart";
import WeightFilters from "@/components/WeightFilters";

export const dynamic = "force-dynamic";

const PER_ROW = 5; // date/weight column pairs in the table

export default async function Weight({
  searchParams,
}: {
  searchParams: Promise<{ height?: string; period?: string; from?: string; to?: string; unit?: string; view?: string }>;
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
  const view = sp.view === "table" ? "table" : "chart";

  const rows = height
    ? await prisma.weight.findMany({ where: { height, date: dateFilter(period, from, to) }, orderBy: { date: "asc" } })
    : [];
  const weights = rows.map((r) => r.weight);
  const stat = (n: number) => Number(n.toFixed(2));
  const points = aggregate(rows.map((r) => ({ date: r.date.toISOString().slice(0, 10), weight: r.weight })), unit);
  const tableRows = Math.ceil(points.length / PER_ROW);

  return (
    <>
      <div className="head">
        <WeightFilters persons={persons} height={height} period={period} from={from} to={to} unit={unit} view={view} />
      </div>
      {points.length === 0 ? (
        <p className="muted">Καμία μέτρηση στην επιλεγμένη περίοδο.</p>
      ) : (
        <div className="card">
          <p className="muted small">
            {rows.length} μετρήσεις · {points.length} σημεία (μέσος όρος ανά {UNITS[unit].toLowerCase()}) · Max:{" "}
            <b>{stat(Math.max(...weights))}</b> · Min: <b>{stat(Math.min(...weights))}</b> · Average:{" "}
            <b>{stat(weights.reduce((a, b) => a + b, 0) / weights.length)}</b>
          </p>
          {view === "chart" ? (
            <LineChart points={points} min={null} max={null} condition={null} />
          ) : (
            <div className="gridwrap" style={{ margin: 0 }}>
              <table className="grid wgrid" style={{ tableLayout: "fixed", width: "100%" }}>
                <thead>
                  <tr>
                    {Array.from({ length: PER_ROW }, (_, k) => [
                      <th key={`d${k}`} className={k % 2 ? "" : "alt"}>{UNITS[unit]}</th>,
                      <th key={`v${k}`} className={k % 2 ? "c" : "c alt"}>kg</th>,
                    ])}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: tableRows }, (_, r) => (
                    <tr key={r}>
                      {Array.from({ length: PER_ROW }, (_, k) => {
                        const p = points[k * tableRows + r]; // oldest first, increasing down each column
                        return [
                          <td key={`d${k}`} className={k % 2 ? "" : "alt"}>{p ? bucketLabel(p.date, unit) : ""}</td>,
                          <td key={`v${k}`} className={k % 2 ? "c" : "c alt"}>{p?.value ?? ""}</td>,
                        ];
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </>
  );
}
