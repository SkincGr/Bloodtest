import { prisma } from "@/lib/db";
import Uploader from "@/components/Uploader";
import ExportData from "@/components/ExportData";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [persons, groups, items] = await Promise.all([
    prisma.person.findMany({ orderBy: { id: "asc" } }),
    prisma.group.findMany({ orderBy: { id: "asc" } }),
    prisma.bloodItem.findMany({ orderBy: { id: "asc" }, select: { id: true, name: true, code: true, groupId: true, subgroupId: true } }),
  ]);
  const exportGroups = groups
    .map((g) => ({
      id: g.id,
      name: g.name,
      items: items
        .filter((i) => i.groupId === g.id)
        .sort((a, b) => (a.subgroupId ?? 1e9) - (b.subgroupId ?? 1e9) || a.id - b.id)
        .map((i) => ({ id: i.id, name: i.name })),
    }))
    .filter((g) => g.items.length > 0);
  return (
    <>
      <h1>Export/Import</h1>
      <h2>Εισαγωγή PDF εξετάσεων</h2>
      <Uploader
        persons={persons.map((p) => ({ id: p.id, name: p.name, mrn: p.mrn }))}
        groups={groups.map((g) => ({ id: g.id, name: g.name }))}
        items={items.map((i) => ({ id: i.id, name: i.name, code: i.code }))}
      />
      <h2>Export Data</h2>
      <ExportData persons={persons.map((p) => ({ id: p.id, name: p.name }))} groups={exportGroups} />
    </>
  );
}
