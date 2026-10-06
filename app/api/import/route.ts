import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

type Body = {
  personId: number;
  mrn?: string | null;
  date: string; // YYYY-MM-DD
  values: { itemId: number; value: number }[];
};

export async function POST(req: Request) {
  const b = (await req.json().catch(() => null)) as Body | null;
  if (
    !b ||
    !Number.isInteger(b.personId) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(b.date) ||
    !Array.isArray(b.values) ||
    b.values.some((v) => !Number.isInteger(v.itemId) || !Number.isFinite(v.value))
  )
    return NextResponse.json({ error: "Μη έγκυρα δεδομένα" }, { status: 400 });

  const person = await prisma.person.findUnique({ where: { id: b.personId } });
  if (!person) return NextResponse.json({ error: "Άγνωστο πρόσωπο" }, { status: 400 });

  const res = await prisma.bloodTest.createMany({
    data: b.values.map((v) => ({
      personId: b.personId,
      itemId: v.itemId,
      date: new Date(b.date),
      value: v.value,
    })),
    skipDuplicates: true,
  });
  // Remember the MRN for next time.
  if (b.mrn && !person.mrn)
    await prisma.person
      .update({ where: { id: person.id }, data: { mrn: b.mrn } })
      .catch(() => {});
  return NextResponse.json({ inserted: res.count, skipped: b.values.length - res.count });
}
