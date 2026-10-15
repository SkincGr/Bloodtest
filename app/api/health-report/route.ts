import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateHealthReport, REPORT_MODEL } from "@/lib/healthReport";

export const maxDuration = 60; // seconds (the Claude call can take a while)

// POST { person }: reads the Ιστορικό + the last measurements, asks Claude for a health report and saves it.
export async function POST(req: Request) {
  const b = await req.json().catch(() => null);
  const personId = Number(b?.person);
  if (!Number.isInteger(personId) || !(await prisma.person.findUnique({ where: { id: personId } })))
    return NextResponse.json({ error: "Άγνωστο πρόσωπο" }, { status: 400 });

  const r = await generateHealthReport(personId);
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: 422 });

  // α/α = next running number of this person (retry once if two requests race)
  for (let attempt = 0; attempt < 2; attempt++) {
    const last = await prisma.healthReport.aggregate({ where: { personId }, _max: { seq: true } });
    try {
      const rep = await prisma.healthReport.create({
        data: { personId, seq: (last._max.seq ?? 0) + 1, html: r.html, model: REPORT_MODEL },
        select: { id: true },
      });
      return NextResponse.json({ ok: true, id: rep.id });
    } catch (e) {
      if (attempt) throw e;
    }
  }
  return NextResponse.json({ error: "Αποτυχία αποθήκευσης" }, { status: 500 });
}
