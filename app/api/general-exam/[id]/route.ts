import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseExamForm } from "@/lib/generalExam";

// GET /api/general-exam/:id -> the stored PDF (prototype) of a GeneralExam.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const exam = await prisma.generalExam.findUnique({
    where: { id: Number((await params).id) || 0 },
    select: { prototype: true, prototypeName: true },
  });
  if (!exam?.prototype) return new Response("Δεν υπάρχει PDF", { status: 404 });
  const name = exam.prototypeName ?? "prototype.pdf";
  return new Response(new Uint8Array(exam.prototype), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="prototype.pdf"; filename*=UTF-8''${encodeURIComponent(name)}`,
    },
  });
}

// PATCH multipart (same fields as the create form): edits the record. A new `prototype` PDF replaces the old one,
// removePdf=on drops it, otherwise the stored PDF is kept.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id) || 0;
  const f = await req.formData().catch(() => null);
  if (!f) return NextResponse.json({ error: "Μη έγκυρα δεδομένα" }, { status: 400 });
  const p = await parseExamForm(f);
  if (p.error !== undefined) return NextResponse.json({ error: p.error }, { status: 400 });
  const { pdf, removePdf, ...fields } = p.fields;
  try {
    await prisma.generalExam.update({
      where: { id },
      data: {
        ...fields,
        ...(pdf ? { prototype: pdf.data, prototypeName: pdf.name } : removePdf ? { prototype: null, prototypeName: null } : {}),
      },
    });
  } catch {
    return NextResponse.json({ error: "Άγνωστη εγγραφή" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
