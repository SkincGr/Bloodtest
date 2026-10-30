import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { storedValue } from "@/lib/units";

type Body = {
  personId: number;
  mrn?: string | null;
  date: string; // YYYY-MM-DD
  values: { itemId: number; value: number; unit?: string | null; range?: string | null }[];
};

const isDate = (d: unknown): d is string => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d);

// How many results this person already has on that date (shown before the user confirms a replace).
export async function GET(req: Request) {
  const u = new URL(req.url);
  const personId = Number(u.searchParams.get("personId"));
  const date = u.searchParams.get("date");
  if (!Number.isInteger(personId) || !isDate(date))
    return NextResponse.json({ error: "Μη έγκυρα δεδομένα" }, { status: 400 });
  const count = await prisma.bloodTest.count({ where: { personId, date: new Date(date) } });
  return NextResponse.json({ count });
}

// Replaces ALL results of that person on that date with the imported ones (delete + insert, one transaction).
export async function POST(req: Request) {
  const b = (await req.json().catch(() => null)) as Body | null;
  if (
    !b ||
    !Number.isInteger(b.personId) ||
    !isDate(b.date) ||
    !Array.isArray(b.values) ||
    b.values.length === 0 ||
    b.values.some((v) => !Number.isInteger(v.itemId) || !Number.isFinite(v.value))
  )
    return NextResponse.json({ error: "Μη έγκυρα δεδομένα" }, { status: 400 });

  const person = await prisma.person.findUnique({ where: { id: b.personId } });
  if (!person) return NextResponse.json({ error: "Άγνωστο πρόσωπο" }, { status: 400 });

  const date = new Date(b.date);
  // A value listed twice would violate the unique key; keep the last one.
  const byItem = new Map(b.values.map((v) => [v.itemId, v]));

  // A lab may have changed the unit of an exam (e.g. T4 µg/dL instead of nmol/L): the value is stored in the exam's
  // own unit, and the unit + limits the lab printed are kept next to it.
  const items = await prisma.bloodItem.findMany({
    where: { id: { in: [...byItem.keys()] } },
    select: { id: true, name: true, min: true, max: true, condition: true },
  });
  const nameOf = new Map(items.map((it) => [it.id, it.name.replace(/\s*\n\s*/g, " / ")]));
  const rows = items.map((it) => {
    const v = byItem.get(it.id)!;
    const unit = v.unit?.trim().slice(0, 30) || undefined;
    const range = v.range?.trim().slice(0, 30) || undefined;
    return { it, unit, range, s: storedValue(it.id, v.value, unit, range, it) };
  });
  const converted = rows
    .filter((r) => r.s.origValue != null)
    .map((r) => ({ itemId: r.it.id, name: nameOf.get(r.it.id)!, from: r.s.origValue!, to: r.s.value, label: r.s.convNote! }));
  const suspect = rows.filter((r) => r.s.suspect).map((r) => ({ name: nameOf.get(r.it.id)!, unit: r.unit ?? null, why: r.s.suspect! }));

  try {
    const [removed, created] = await prisma.$transaction([
      prisma.bloodTest.deleteMany({ where: { personId: b.personId, date } }),
      prisma.bloodTest.createMany({
        data: rows.map((r) => ({
          personId: b.personId,
          itemId: r.it.id,
          date,
          value: r.s.value,
          origValue: r.s.origValue,
          convNote: r.s.convNote,
          unit: r.unit ?? null,
          refRange: r.range ?? null,
        })),
      }),
    ]);
    // Remember the MRN for next time.
    if (b.mrn && !person.mrn)
      await prisma.person.update({ where: { id: person.id }, data: { mrn: b.mrn } }).catch(() => {});
    return NextResponse.json({ deleted: removed.count, inserted: created.count, converted, suspect });
  } catch {
    return NextResponse.json({ error: "Δεν αποθηκεύτηκε (δεν άλλαξε τίποτα). Δοκίμασε ξανά." }, { status: 500 });
  }
}
