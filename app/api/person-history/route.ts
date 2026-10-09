import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sanitizeHtml } from "@/lib/sanitizeHtml";

const MAX_HISTORY = 1_500_000; // characters of HTML (~3 MB in UTF-8, below the ~4.5 MB request limit of Vercel)

// PUT { person, html }: saves the free-text health history of a person (sanitized HTML)
export async function PUT(req: Request) {
  const b = await req.json().catch(() => null);
  const personId = Number(b?.person);
  const html = typeof b?.html === "string" ? b.html : null;
  if (!Number.isInteger(personId) || html === null) return NextResponse.json({ error: "Μη έγκυρα δεδομένα" }, { status: 400 });
  if (html.length > MAX_HISTORY)
    return NextResponse.json({ error: `Το κείμενο είναι πολύ μεγάλο (${html.length.toLocaleString("el-GR")} από ${MAX_HISTORY.toLocaleString("el-GR")} χαρακτήρες)` }, { status: 400 });
  if (!(await prisma.person.findUnique({ where: { id: personId } })))
    return NextResponse.json({ error: "Άγνωστο πρόσωπο" }, { status: 400 });
  const clean = sanitizeHtml(html);
  await prisma.personHistory.upsert({
    where: { personId },
    update: { html: clean },
    create: { personId, html: clean },
  });
  return NextResponse.json({ ok: true, html: clean });
}
