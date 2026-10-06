import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseRange } from "@/lib/range";

type Body = { name: string; code?: string | null; groupId: number; range?: string | null };

// Adds a new exam to BloodItems (used when a PDF row matches no existing exam).
export async function POST(req: Request) {
  const b = (await req.json().catch(() => null)) as Body | null;
  const name = b?.name?.replace(/\s+/g, " ").trim();
  const code = b?.code?.trim() || null;
  if (!b || !name || name.length > 200 || (code && code.length > 60) || !Number.isInteger(b.groupId))
    return NextResponse.json({ error: "Μη έγκυρα δεδομένα" }, { status: 400 });

  const group = await prisma.group.findUnique({ where: { id: b.groupId } });
  if (!group) return NextResponse.json({ error: "Άγνωστο group" }, { status: 400 });
  if (await prisma.bloodItem.findUnique({ where: { name } }))
    return NextResponse.json({ error: "Υπάρχει ήδη εξέταση με αυτό το όνομα" }, { status: 409 });

  const range = parseRange(b.range);
  // Ids come from Access (not auto-increment), so continue after the highest one.
  const last = await prisma.bloodItem.aggregate({ _max: { id: true } });
  try {
    const item = await prisma.bloodItem.create({
      data: {
        id: (last._max.id ?? 0) + 1,
        name,
        code,
        groupId: group.id,
        valueRange: b.range?.replace(/\s+/g, "").replace(/,/g, ".") || null,
        condition: range?.condition ?? null,
        min: range?.min ?? null,
        max: range?.max ?? null,
      },
      select: { id: true, name: true, code: true },
    });
    return NextResponse.json(item);
  } catch {
    return NextResponse.json({ error: "Δεν αποθηκεύτηκε η εξέταση (δοκίμασε ξανά)" }, { status: 409 });
  }
}
