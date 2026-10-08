import { prisma } from "@/lib/db";
import NewGeneralExam from "@/components/NewGeneralExam";

export const dynamic = "force-dynamic";

export default async function ExamsImport() {
  const [persons, groups] = await Promise.all([
    prisma.person.findMany({ orderBy: { id: "asc" } }),
    prisma.groupGen.findMany({ orderBy: { name: "asc" } }),
  ]);
  return (
    <>
      <h1>Εισαγωγή</h1>
      <NewGeneralExam persons={persons.map((p) => ({ id: p.id, name: p.name }))} groups={groups.map((g) => ({ id: g.GroupGen_ID, name: g.name }))} />
    </>
  );
}
