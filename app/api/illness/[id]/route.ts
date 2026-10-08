import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { bad, intId, parseIllness } from "@/lib/illness";

// PATCH { title, description?, startDate?, endDate? }: edit the illness
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = await intId(params);
  const p = parseIllness(await req.json().catch(() => null));
  if (p.error !== undefined) return bad(p.error);
  const r = await prisma.illness.updateMany({ where: { id }, data: p.data });
  return r.count ? NextResponse.json({ ok: true }) : bad("Άγνωστη ασθένεια", 404);
}

// DELETE: the illness with its medication and exams.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = await intId(params);
  if (!id) return bad("Άγνωστη ασθένεια", 404);
  await prisma.illness.deleteMany({ where: { id } });
  return NextResponse.json({ ok: true });
}
