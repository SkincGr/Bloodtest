import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { bad, clean, day, intId, pdfResponse, readPdf } from "@/lib/illness";

// GET: the stored PDF
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const e = await prisma.illnessExam.findUnique({
    where: { id: await intId(params) },
    select: { prototype: true, prototypeName: true },
  });
  if (!e?.prototype) return new Response("Δεν υπάρχει PDF", { status: 404 });
  return pdfResponse(e.prototype, e.prototypeName ?? "exam.pdf");
}

// PATCH multipart: title, date?, text?, prototype? (a new PDF replaces the old one), removePdf=on (drops the old one)
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = await intId(params);
  const f = await req.formData().catch(() => null);
  if (!f) return bad("Μη έγκυρα δεδομένα");
  const title = clean(f.get("title"), 300);
  const date = day(f.get("date"));
  const text = clean(f.get("text"), 20000);
  if (!title || date === undefined) return bad("Συμπλήρωσε τίτλο (και σωστή ημερομηνία)");
  const pdf = await readPdf(f.get("prototype"));
  if (pdf.error) return bad(pdf.error);
  const old = await prisma.illnessExam.findUnique({ where: { id }, select: { prototypeName: true } });
  if (!old) return bad("Άγνωστη εγγραφή", 404);
  const keepPdf = !pdf.data && f.get("removePdf") !== "on" && !!old.prototypeName;
  if (!text && !pdf.data && !keepPdf) return bad("Βάλε κείμενο ή PDF");
  await prisma.illnessExam.update({
    where: { id },
    data: {
      title,
      date,
      text: text || null,
      ...(pdf.data ? { prototype: pdf.data, prototypeName: pdf.name } : keepPdf ? {} : { prototype: null, prototypeName: null }),
    },
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = await intId(params);
  if (!id) return bad("Άγνωστη εγγραφή", 404);
  await prisma.illnessExam.deleteMany({ where: { id } });
  return NextResponse.json({ ok: true });
}
