import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { bad, intId, parseMedication } from "@/lib/illness";

// PATCH { title, dosage?, fromDate?, toDate?, notes? }: edit the medication
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = await intId(params);
  const p = parseMedication(await req.json().catch(() => null));
  if (p.error !== undefined) return bad(p.error);
  const r = await prisma.medication.updateMany({ where: { id }, data: p.data });
  return r.count ? NextResponse.json({ ok: true }) : bad("Άγνωστο φάρμακο", 404);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = await intId(params);
  if (!id) return bad("Άγνωστο φάρμακο", 404);
  await prisma.medication.deleteMany({ where: { id } });
  return NextResponse.json({ ok: true });
}
