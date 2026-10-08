import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { bad, clean, day, intId, readPdf } from "@/lib/illness";

// POST multipart: title, date?, text?, prototype? (PDF) - needs text or a PDF
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const illnessId = await intId(params);
  const f = await req.formData().catch(() => null);
  if (!f) return bad("Μη έγκυρα δεδομένα");
  const title = clean(f.get("title"), 300);
  const date = day(f.get("date"));
  const text = clean(f.get("text"), 20000);
  if (!title || date === undefined) return bad("Συμπλήρωσε τίτλο (και σωστή ημερομηνία)");
  const pdf = await readPdf(f.get("prototype"));
  if (pdf.error) return bad(pdf.error);
  if (!text && !pdf.data) return bad("Βάλε κείμενο ή PDF");
  if (!illnessId || !(await prisma.illness.findUnique({ where: { id: illnessId } }))) return bad("Άγνωστη ασθένεια", 404);
  const r = await prisma.illnessExam.create({
    data: { illnessId, title, date, text: text || null, prototype: pdf.data, prototypeName: pdf.name },
    select: { id: true },
  });
  return NextResponse.json({ ok: true, id: r.id });
}
