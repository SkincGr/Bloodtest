import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

type Body = {
  personId: number;
  mrn?: string | null;
  date: string; // YYYY-MM-DD
  values: { itemId: number; value: number }[];
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
  const byItem = new Map(b.values.map((v) => [v.itemId, v.value]));

  try {
    const [removed, created] = await prisma.$transaction([
      prisma.bloodTest.deleteMany({ where: { personId: b.personId, date } }),
      prisma.bloodTest.createMany({
        data: [...byItem].map(([itemId, value]) => ({ personId: b.personId, itemId, date, value })),
      }),
    ]);
    // Remember the MRN for next time.
    if (b.mrn && !person.mrn)
      await prisma.person.update({ where: { id: person.id }, data: { mrn: b.mrn } }).catch(() => {});
    return NextResponse.json({ deleted: removed.count, inserted: created.count });
  } catch {
    return NextResponse.json({ error: "Δεν αποθηκεύτηκε (δεν άλλαξε τίποτα). Δοκίμασε ξανά." }, { status: 500 });
  }
}
