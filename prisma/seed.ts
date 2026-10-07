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

  // The old import script wrote the PDF's MRN (66520) into Person_ID; that patient is Chris (id 1).
  // Height (cm) identifies whose rows they are in the Weight table.
  const PERSON_HEIGHT: Record<number, number> = { 1: 193, 3: 166 };
  const MRN_TO_PERSON: Record<number, number> = { 66520: 1 };

  for (const p of persons) {
    const mrn = Object.entries(MRN_TO_PERSON).find(([, id]) => id === p.Person_Id)?.[0] ?? null;
    const height = PERSON_HEIGHT[p.Person_Id] ?? null;
    await prisma.person.upsert({
      where: { id: p.Person_Id },
      update: { name: p.Person_Name, mrn, height },
      create: { id: p.Person_Id, name: p.Person_Name, mrn, height },
    });
  }

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
      personId: MRN_TO_PERSON[t.Person_ID] ?? t.Person_ID,
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
