import { prisma } from "@/lib/db";
import ValuesGrid, { sectionsByGroup } from "@/components/ValuesGrid";

export const dynamic = "force-dynamic";

export default async function History({
  searchParams,
}: {
  searchParams: Promise<{ person?: string }>;
}) {
  const sp = await searchParams;
  const persons = await prisma.person.findMany({ orderBy: { id: "asc" } });
  const personId = Number(sp.person) || persons[0]?.id;
  const tests = personId
    ? await prisma.bloodTest.findMany({ where: { personId }, select: { itemId: true, date: true, value: true } })
    : [];
  const itemIds = new Set(tests.map((t) => t.itemId));
  const items = (
    await prisma.bloodItem.findMany({
      include: { group: true },
      orderBy: [{ groupId: "asc" }, { id: "asc" }],
    })
  ).filter((i) => itemIds.has(i.id));

  return (
    <>
      <h1>Πίνακας εξετάσεων</h1>
      <form className="row">
        <select name="person" defaultValue={personId}>
          {persons.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <button type="submit">Εμφάνιση</button>
      </form>
      <ValuesGrid sections={sectionsByGroup(items)} tests={tests} />
    </>
  );
}
