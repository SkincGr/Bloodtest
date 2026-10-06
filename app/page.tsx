import { prisma } from "@/lib/db";
import Uploader from "@/components/Uploader";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [persons, items] = await Promise.all([
    prisma.person.findMany({ orderBy: { id: "asc" } }),
    prisma.bloodItem.findMany({ orderBy: { id: "asc" }, select: { id: true, name: true } }),
  ]);
  return (
    <>
      <h1>Εισαγωγή PDF εξετάσεων</h1>
      <Uploader
        persons={persons.map((p) => ({ id: p.id, name: p.name, mrn: p.mrn }))}
        items={items}
      />
    </>
  );
}
