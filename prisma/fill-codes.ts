// Fills BloodItem.code from the Latin abbreviations in each item's name. Safe to re-run:
// only items whose code is empty are touched, so codes you edit by hand are kept.
import { PrismaClient } from "@prisma/client";
import { extractCodes } from "../lib/itemCode";

const prisma = new PrismaClient();

async function main() {
  const items = await prisma.bloodItem.findMany({ orderBy: { id: "asc" } });
  let n = 0;
  for (const i of items) {
    if (i.code) continue;
    const code = extractCodes(i.name.replace(/\s*\n\s*/g, " / ")).join(", ");
    if (!code) continue;
    await prisma.bloodItem.update({ where: { id: i.id }, data: { code } });
    n++;
  }
  console.log(`Filled ${n} codes (of ${items.length} items).`);
}

main().finally(() => prisma.$disconnect());
