import { prisma } from "@/lib/db";
import Uploader from "@/components/Uploader";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [persons, groups, items] = await Promise.all([
    prisma.person.findMany({ orderBy: { id: "asc" } }),
    prisma.group.findMany({ orderBy: { id: "asc" } }),
    prisma.bloodItem.findMany({ orderBy: { id: "asc" }, select: { id: true, name: true, code: true } }),
  ]);
  return (
    <>
      <h1>Εισαγωγή PDF εξετάσεων</h1>
      <Uploader
        persons={persons.map((p) => ({ id: p.id, name: p.name, mrn: p.mrn }))}
        groups={groups.map((g) => ({ id: g.id, name: g.name }))}
        items={items}
      />
    </>
  );
}
