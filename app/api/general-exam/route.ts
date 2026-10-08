import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseExamForm } from "@/lib/generalExam";

// POST multipart: person, date (YYYY-MM-DD), title, text? (HTML), analysis? (HTML), group? (GroupGen_ID), prototype? (PDF file)
export async function POST(req: Request) {
  const f = await req.formData().catch(() => null);
  if (!f) return NextResponse.json({ error: "Μη έγκυρα δεδομένα" }, { status: 400 });
  const p = await parseExamForm(f);
  if (p.error !== undefined) return NextResponse.json({ error: p.error }, { status: 400 });
  const { pdf, removePdf: _ignored, ...fields } = p.fields;
  const exam = await prisma.generalExam.create({
    data: { ...fields, prototype: pdf?.data ?? null, prototypeName: pdf?.name ?? null },
    select: { id: true },
  });
  return NextResponse.json({ ok: true, id: exam.id });
}
