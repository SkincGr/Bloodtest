import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { bad, intId, parseMedication } from "@/lib/illness";

// POST { title, dosage?, fromDate?, toDate?, notes? }
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const illnessId = await intId(params);
  const p = parseMedication(await req.json().catch(() => null));
  if (p.error !== undefined) return bad(p.error);
  if (!illnessId || !(await prisma.illness.findUnique({ where: { id: illnessId } }))) return bad("Άγνωστη ασθένεια", 404);
  const r = await prisma.medication.create({ data: { illnessId, ...p.data }, select: { id: true } });
  return NextResponse.json({ ok: true, id: r.id });
}
