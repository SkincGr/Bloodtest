import { prisma } from "@/lib/db";
import { dateFilter, readPeriod } from "@/lib/period";

const fmt = (d: Date) => d.toISOString().slice(0, 10).split("-").reverse().join("/");

// GET /api/export?person=&items=1,2,3&period=&from=&to= -> .txt with the measurements of each selected exam
// in the chosen period (same periods as the other pages; default: all measurements).
// Line format: ΗΜΕΡΟΜΗΝΙΑ - ΠΕΡΙΓΡΑΦΗ - ΣΥΜΒΟΛΟ - ΤΙΜΗ
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const personId = Number(sp.get("person"));
  const itemIds = (sp.get("items") ?? "").split(",").map(Number).filter((n) => Number.isInteger(n) && n > 0);
  const { period, from, to } = readPeriod({
    period: sp.get("period") ?? undefined,
    from: sp.get("from") ?? undefined,
    to: sp.get("to") ?? undefined,
  });
  const person = await prisma.person.findUnique({ where: { id: personId } });
  if (!person || !itemIds.length) return new Response("Άγνωστο πρόσωπο ή καμία εξέταση", { status: 400 });

  const items = await prisma.bloodItem.findMany({
    where: { id: { in: itemIds } },
    orderBy: [{ groupId: "asc" }, { subgroupId: "asc" }, { id: "asc" }],
    include: {
      tests: { where: { personId, date: dateFilter(period, from, to) }, orderBy: { date: "desc" } },
    },
  });

  const lines: string[] = [];
  for (const it of items) {
    const name = it.name.replace(/\s*\n\s*/g, " / ").trim();
    for (const t of it.tests) lines.push([fmt(t.date), name, it.code ?? "", t.value].join(" - "));
  }

  const file = `export-${person.name}`.replace(/[^\p{L}\p{N}._-]+/gu, "_") + ".txt";
  return new Response("﻿" + lines.join("\r\n") + "\r\n", {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="export.txt"; filename*=UTF-8''${encodeURIComponent(file)}`,
    },
  });
}
