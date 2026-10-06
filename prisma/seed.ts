import { PrismaClient } from "@prisma/client";
import { readFileSync } from "fs";
import { join } from "path";

const prisma = new PrismaClient();
const load = (n: string) =>
  JSON.parse(readFileSync(join(__dirname, "..", "data", `${n}.json`), "utf-8"));

async function main() {
  const groups = load("Groups");
  const persons = load("Persons");
  const items = load("BloodItems");
  const tests = load("BloodTest");

  for (const g of groups)
    await prisma.group.upsert({
      where: { id: g.Group_ID },
      update: { name: g.Group_Name },
      create: { id: g.Group_ID, name: g.Group_Name },
    });
  const groupIds = new Set<number>(groups.map((g: any) => g.Group_ID));

  for (const p of persons)
    await prisma.person.upsert({
      where: { id: p.Person_Id },
      update: { name: p.Person_Name },
      create: { id: p.Person_Id, name: p.Person_Name },
    });

  for (const i of items) {
    const data = {
      groupId: groupIds.has(i.Group_ID) ? i.Group_ID : null,
      name: i.Item_Name.trim(),
      valueRange: i["Value Range"]?.trim() ?? null,
      condition: i.Codition ?? null,
      min: i.Min,
      max: i.Max,
    };
    await prisma.bloodItem.upsert({
      where: { id: i.Item_AID },
      update: data,
      create: { id: i.Item_AID, ...data },
    });
  }

  const byName = new Map<string, number>(
    items.map((i: any) => [i.Item_Name.trim(), i.Item_AID]),
  );
  const missing = new Set<string>();
  const rows: any[] = [];
  for (const t of tests) {
    const itemId = byName.get((t.Item ?? "").trim());
    if (!itemId || t.Value == null || !t.Date) {
      missing.add(t.Item);
      continue;
    }
    rows.push({
      personId: t.Person_ID,
      itemId,
      date: new Date(t.Date.slice(0, 10)),
      value: t.Value,
    });
  }
  const res = await prisma.bloodTest.createMany({ data: rows, skipDuplicates: true });
  console.log(`Imported ${res.count}/${tests.length} tests.`);
  if (missing.size) console.log("Skipped (no matching item):", [...missing]);
}

main().finally(() => prisma.$disconnect());
