import Link from "next/link";
import { prisma } from "@/lib/db";
import { evaluate, formatPct } from "@/lib/range";
import { compare, TREND_LABEL, type Reading } from "@/lib/trend";
import { dateFilter, readPeriod } from "@/lib/period";
import PeriodPicker from "@/components/PeriodPicker";

export const dynamic = "force-dynamic";

const iso = (d: Date) => d.toISOString().slice(0, 10);
const short = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(2, 4)}`;

export default async function Outliers({
  searchParams,
}: {
  searchParams: Promise<{ person?: string; period?: string; from?: string; to?: string }>;
}) {
  const sp = await searchParams;
  const persons = await prisma.person.findMany({ orderBy: { id: "asc" } });
  const personId = Number(sp.person) || persons[0]?.id;
  const { period, from, to } = readPeriod(sp);

  const tests = personId
    ? await prisma.bloodTest.findMany({
        where: { personId, date: dateFilter(period, from, to) },
        include: { item: { include: { group: true, subgroup: true } } },
        orderBy: { date: "asc" },
      })
    : [];

  // Readings per exam, oldest first.
  const byItem = new Map<number, { item: (typeof tests)[number]["item"]; readings: Reading[] }>();
  for (const t of tests) {
    const e = byItem.get(t.itemId) ?? { item: t.item, readings: [] };
    e.readings.push({ date: iso(t.date), value: t.value, ...evaluate(t.value, t.item.min, t.item.max, t.item.condition) });
    byItem.set(t.itemId, e);
  }

  const rows = [...byItem.values()]
    .filter((e) => e.readings.some((r) => r.out))
    .map((e) => {
      const rs = e.readings;
      const last = rs[rs.length - 1];
      return {
        ...e,
        last,
        outs: rs.filter((r) => r.out),
        latest: rs.length > 1 ? compare(rs[rs.length - 2], last) : null, // last vs the one before
        overall: rs.length > 2 ? compare(rs[0], last) : null, // last vs the first in the period
      };
    })
    // still out of range first, then the biggest deviation
    .sort((a, b) => Number(b.last.out) - Number(a.last.out) || Math.abs(b.last.pct ?? 0) - Math.abs(a.last.pct ?? 0));

  const nowOut = rows.filter((r) => r.last.out).length;
  const worse = rows.filter((r) => r.latest === "worse" || r.latest === "new").length;
  const better = rows.filter((r) => r.latest === "better" || r.latest === "back").length;

  return (
    <>
      <div className="head">
        <h1>Εκτός ορίων</h1>
        <PeriodPicker path="/outliers" period={period} from={from} to={to} persons={persons} person={personId} />
      </div>

      {rows.length === 0 ? (
        <p className="muted">Καμία τιμή εκτός ορίων στην επιλεγμένη περίοδο ({tests.length} μετρήσεις).</p>
      ) : (
        <>
          <p>
            <strong>{rows.length}</strong> εξετάσεις είχαν τιμές εκτός ορίων · τώρα εκτός: <strong>{nowOut}</strong> ·{" "}
            <span className="bad">{worse} χειροτερεύουν</span> · <span className="ok">{better} βελτιώνονται</span>
          </p>
          <div className="card tablewrap">
            <table>
              <thead>
                <tr>
                  <th>Εξέταση</th>
                  <th>Φυσιολογικό</th>
                  <th>Τιμές εκτός ορίων (απόκλιση)</th>
                  <th>Τελευταία</th>
                  <th>Τάση</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const t = r.latest && TREND_LABEL[r.latest];
                  const o = r.overall && TREND_LABEL[r.overall];
                  return (
                    <tr key={r.item.id}>
                      <td>
                        {r.item.name}
                        <div className="muted small">{[r.item.group?.name, r.item.subgroup?.name].filter(Boolean).join(" › ")}</div>
                      </td>
                      <td className="muted">{r.item.valueRange}</td>
                      <td className="chips">
                        {r.outs.map((o) => (
                          <span className="chip" key={o.date}>
                            {short(o.date)}: <b>{o.value}</b>
                            {o.pct != null && <span className="bad"> ({formatPct(o.pct)})</span>}
                          </span>
                        ))}
                      </td>
                      <td className={r.last.out ? "bad" : ""}>
                        {short(r.last.date)}: <b>{r.last.value}</b>
                        {r.last.out && r.last.pct != null && ` (${formatPct(r.last.pct)})`}
                      </td>
                      <td>
                        {t ? <span className={t.cls}>{t.text}</span> : <span className="muted">1 μέτρηση</span>}
                        {o && r.overall !== r.latest && (
                          <div className="muted small">
                            από την αρχή: <span className={o.cls}>{o.text.slice(2)}</span>
                          </div>
                        )}
                      </td>
                      <td>
                        <Link href={`/trends?person=${personId}&items=${r.item.id}&period=${period}${period === "custom" ? `&from=${from}&to=${to}` : ""}`}>
                          Γράφημα
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="muted small">
            Τάση = η τελευταία μέτρηση σε σχέση με την προηγούμενη (αλλαγή της απόκλισης κάτω από ~2 ποσοστιαίες μονάδες ή 10% θεωρείται σταθερό).
            Η απόκλιση μετριέται από το όριο που ξεπεράστηκε.
          </p>
        </>
      )}
    </>
  );
}
