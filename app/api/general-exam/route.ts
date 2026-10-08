import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const MAX_PDF = 4 * 1024 * 1024; // stays below the ~4.5 MB request limit of Vercel functions

const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v.trim() : "");

// POST multipart: person, date (YYYY-MM-DD), title, text?, textIsHtml?, analysis?, group? (GroupGen_ID), prototype? (PDF file)
export async function POST(req: Request) {
  const f = await req.formData().catch(() => null);
  if (!f) return NextResponse.json({ error: "Μη έγκυρα δεδομένα" }, { status: 400 });

  const personId = Number(str(f.get("person")));
  const date = str(f.get("date"));
  const title = str(f.get("title"));
  if (!Number.isInteger(personId) || !/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date)) || !title || title.length > 300)
    return NextResponse.json({ error: "Συμπλήρωσε πρόσωπο, ημερομηνία και τίτλο" }, { status: 400 });
  if (!(await prisma.person.findUnique({ where: { id: personId } })))
    return NextResponse.json({ error: "Άγνωστο πρόσωπο" }, { status: 400 });

  let prototype: Uint8Array<ArrayBuffer> | null = null;
  let prototypeName: string | null = null;
  const file = f.get("prototype");
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_PDF) return NextResponse.json({ error: "Το PDF είναι πάνω από 4 MB" }, { status: 400 });
    prototype = new Uint8Array(await file.arrayBuffer());
    if (new TextDecoder().decode(prototype.subarray(0, 5)) !== "%PDF-")
      return NextResponse.json({ error: "Το αρχείο δεν είναι PDF" }, { status: 400 });
    prototypeName = file.name.slice(0, 200);
  }

  const groupGenId: number | null = Number(str(f.get("group"))) || null;
  if (groupGenId && !(await prisma.groupGen.findUnique({ where: { GroupGen_ID: groupGenId } })))
    return NextResponse.json({ error: "Άγνωστη ομάδα" }, { status: 400 });

  const exam = await prisma.generalExam.create({
    data: {
      personId,
      date: new Date(date),
      title,
      text: str(f.get("text")) || null,
      textIsHtml: f.get("textIsHtml") === "on",
      analysis: str(f.get("analysis")) || null,
      prototype,
      prototypeName,
      GroupGen_ID: groupGenId,
    },
    select: { id: true },
  });
  return NextResponse.json({ ok: true, id: exam.id });
}
