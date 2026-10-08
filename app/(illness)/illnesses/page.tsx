import { prisma } from "@/lib/db";
import HistoryEditor from "@/components/HistoryEditor";

export const dynamic = "force-dynamic";

export default async function History({ searchParams }: { searchParams: Promise<{ person?: string }> }) {
  const sp = await searchParams;
  const persons = await prisma.person.findMany({ orderBy: { id: "asc" } });
  const personId = Number(sp.person) || persons[0]?.id;
  const history = personId ? await prisma.personHistory.findUnique({ where: { personId } }) : null;

  return (
    <>
      <h1>Ιστορικό</h1>
      <form className="row">
        <select name="person" defaultValue={personId}>
          {persons.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <button type="submit">Εμφάνιση</button>
      </form>
      {personId && <HistoryEditor key={personId} personId={personId} initialHtml={history?.html ?? ""} />}
    </>
  );
}
