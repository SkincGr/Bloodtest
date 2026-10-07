// Creates the subgroups from prisma/subgroups.ts and assigns each exam to its subgroup.
// Safe to re-run. Exams not listed there keep (or get) no subgroup.
import { PrismaClient } from "@prisma/client";
import { SUBGROUPS } from "./subgroups";

const prisma = new PrismaClient();

async function main() {
  const groupIds = new Set((await prisma.group.findMany({ select: { id: true } })).map((g) => g.id));
  const itemIds = new Set((await prisma.bloodItem.findMany({ select: { id: true } })).map((i) => i.id));
  const seen = new Map<number, number>();
  let assigned = 0;

  for (const s of SUBGROUPS) {
    if (!groupIds.has(s.groupId)) {
      console.warn(`Skipped "${s.name}": unknown group ${s.groupId}`);
      continue;
    }
    await prisma.subgroup.upsert({
      where: { id: s.id },
      update: { name: s.name, groupId: s.groupId },
      create: { id: s.id, name: s.name, groupId: s.groupId },
    });
    for (const id of s.items) {
      if (!itemIds.has(id)) { console.warn(`Unknown item ${id} in "${s.name}"`); continue; }
      if (seen.has(id)) console.warn(`Item ${id} is in two subgroups (${seen.get(id)}, ${s.id}); last one wins`);
      seen.set(id, s.id);
      await prisma.bloodItem.update({ where: { id }, data: { subgroupId: s.id, groupId: s.groupId } });
      assigned++;
    }
  }

  // Remove subgroups that are no longer defined.
  const keep = SUBGROUPS.map((s) => s.id);
  await prisma.bloodItem.updateMany({ where: { subgroupId: { notIn: keep } }, data: { subgroupId: null } });
  await prisma.subgroup.deleteMany({ where: { id: { notIn: keep } } });

  const without = await prisma.bloodItem.findMany({ where: { subgroupId: null }, select: { id: true, name: true } });
  console.log(`${SUBGROUPS.length} subgroups, ${assigned} exams assigned.`);
  if (without.length) console.log("Exams without subgroup:", without.map((i) => `${i.id} ${i.name.replace(/\s*\n\s*/g, " / ")}`));
}

main().finally(() => prisma.$disconnect());
