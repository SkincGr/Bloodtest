import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// DELETE: removes one saved health report
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "Άγνωστη αναφορά" }, { status: 404 });
  await prisma.healthReport.deleteMany({ where: { id } });
  return NextResponse.json({ ok: true });
}
