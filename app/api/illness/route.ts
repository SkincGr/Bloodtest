import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { bad, parseIllness } from "@/lib/illness";

// POST { person, title, description?, startDate?, endDate? }
export async function POST(req: Request) {
  const b = await req.json().catch(() => null);
  const personId = Number(b?.person);
  const p = parseIllness(b);
  if (p.error !== undefined) return bad(p.error);
  if (!Number.isInteger(personId) || !(await prisma.person.findUnique({ where: { id: personId } }))) return bad("Άγνωστο πρόσωπο");
  const r = await prisma.illness.create({ data: { personId, ...p.data }, select: { id: true } });
  return NextResponse.json({ ok: true, id: r.id });
}
