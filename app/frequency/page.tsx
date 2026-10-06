import { prisma } from "@/lib/db";
import { repeatAdvice, INTERVAL_MONTHS } from "@/lib/repeat";
import FrequencyTable, { type FreqRow } from "@/components/FrequencyTable";

export const dynamic = "force-dynamic";

const MS_DAY = 24 * 60 * 60 * 1000;

export default async function Frequency({
  searchParams,
}: {
  searchParams: Promise<{ person?: string }>;
}) {
  const sp = await searchParams;
  const persons = await prisma.person.findMany({ orderBy: { id: "asc" } });
  const personId = Number(sp.person) || persons[0]?.id;

  const [items, tests] = await Promise.all([
    prisma.bloodItem.findMany({ include: { group: true }, orderBy: [{ groupId: "asc" }, { id: "asc" }] }),
    personId
      ? prisma.bloodTest.findMany({
          where: { personId },
          orderBy: { date: "desc" },
          select: { itemId: true, date: true, value: true },
        })
      : Promise.resolve([]),
  ]);

  // Readings per exam, newest first.
  const byItem = new Map<number, { date: string; value: number }[]>();
  for (const t of tests) {
    const list = byItem.get(t.itemId) ?? [];
    list.push({ date: t.date.toISOString().slice(0, 10), value: t.value });
    byItem.set(t.itemId, list);
  }

  // "Today" in Greece (the server runs in UTC), so day counts do not flip at the wrong hour.
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Athens" });
  const todayMs = Date.parse(today);

  const rows: FreqRow[] = items.map((it) => {
    const readings = byItem.get(it.id) ?? [];
    const last = readings[0]?.date ?? null;
    return {
      id: it.id,
      name: it.name,
      group: it.group?.name ?? "Άλλα",
      count: readings.length,
      last,
      days: last ? Math.round((todayMs - Date.parse(last)) / MS_DAY) : null,
      rep: repeatAdvice(readings, it, today),
    };
  });

  const due = rows.filter((r) => r.rep.status === "due").length;
  const soon = rows.filter((r) => r.rep.status === "soon").length;

  return (
    <>
      <h1>Συχνότητα</h1>
      <form className="row">
        <select name="person" defaultValue={personId}>
          {persons.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <button type="submit">Εμφάνιση</button>
        <span>
          <span className="bad">{due} πρέπει να γίνουν</span> · <span className="soon">{soon} σύντομα</span>
          <span className="muted"> · {rows.filter((r) => r.count > 0).length} από {rows.length} εξετάσεις έχουν μετρήσεις</span>
        </span>
      </form>
      <FrequencyTable rows={rows} />
      <p className="muted small">
        Επανάληψη: κάθε {INTERVAL_MONTHS.normal} μήνες αν η τελευταία τιμή είναι εντός ορίων, κάθε {INTERVAL_MONTHS.recentOut} αν
        η προηγούμενη ήταν εκτός, κάθε {INTERVAL_MONTHS.out} αν η τελευταία είναι εκτός ορίων. «Σύντομα» = λήγει μέσα στον
        επόμενο μήνα. Είναι υπενθύμιση· τη συχνότητα την ορίζει ο γιατρός (αλλάζει στο lib/repeat.ts).
      </p>
    </>
  );
}
