// Imports data/Weights.json (exported from MyWeight.accdb, table Weights) into the Weight table.
// Per day and height (= person) only the lowest weight is kept; the other readings are skipped and removed.
// Safe to re-run: rows are upserted by their Access ID. Usage: npm run db:weights
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "fs";
import { join } from "path";

const prisma = new PrismaClient();

type Row = { ID: number; date: string; weight: number; height: number | null };

async function main() {
  const rows: Row[] = JSON.parse(readFileSync(join(__dirname, "..", "data", "Weights.json"), "utf-8"));
  // Lowest weight per day + height wins (ties: lowest ID).
  const best = new Map<string, Row>();
  for (const r of rows) {
    const k = `${r.date}|${r.height ?? ""}`;
    const b = best.get(k);
    if (!b || r.weight < b.weight || (r.weight === b.weight && r.ID < b.ID)) best.set(k, r);
  }
  const kept = new Set([...best.values()].map((r) => r.ID));
  const data = [...best.values()].map((r) => ({ id: r.ID, date: new Date(r.date), weight: r.weight, height: r.height }));
  const dropped = rows.filter((r) => !kept.has(r.ID)).map((r) => r.ID);
  const removed = await prisma.weight.deleteMany({ where: { id: { in: dropped } } });
  const existing = new Map((await prisma.weight.findMany()).map((w) => [w.id, w]));
  const fresh = data.filter((d) => !existing.has(d.id));
  const same = (d: (typeof data)[number]) => {
    const e = existing.get(d.id)!;
    return e.weight === d.weight && e.height === d.height && e.date.getTime() === d.date.getTime();
  };
  const res = await prisma.weight.createMany({ data: fresh, skipDuplicates: true });
  const changed = data.filter((d) => existing.has(d.id) && !same(d));
  for (const d of changed)
    await prisma.weight.update({ where: { id: d.id }, data: { date: d.date, weight: d.weight, height: d.height } });
  console.log(`Imported ${res.count} new, updated ${changed.length}, removed ${removed.count} extra readings (of ${rows.length} rows, ${data.length} days).`);
}

main().finally(() => prisma.$disconnect());
