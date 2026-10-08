import { prisma } from "@/lib/db";
import IllnessBoard, { type IllnessView } from "@/components/IllnessBoard";

export const dynamic = "force-dynamic";

const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

export default async function Illnesses({ searchParams }: { searchParams: Promise<{ person?: string }> }) {
  const sp = await searchParams;
  const persons = await prisma.person.findMany({ orderBy: { id: "asc" } });
  const personId = Number(sp.person) || persons[0]?.id;

  const rows = personId
    ? await prisma.illness.findMany({
        where: { personId },
        orderBy: [{ startDate: { sort: "desc", nulls: "last" } }, { id: "desc" }],
        include: {
          medications: { orderBy: [{ fromDate: { sort: "desc", nulls: "last" } }, { id: "desc" }] },
          exams: { orderBy: [{ date: { sort: "desc", nulls: "last" } }, { id: "desc" }], omit: { prototype: true } },
        },
      })
    : [];

  const illnesses: IllnessView[] = rows.map((i) => ({
    id: i.id,
    title: i.title,
    description: i.description,
    startDate: iso(i.startDate),
    endDate: iso(i.endDate),
    medications: i.medications.map((m) => ({
      id: m.id,
      title: m.title,
      dosage: m.dosage,
      fromDate: iso(m.fromDate),
      toDate: iso(m.toDate),
      notes: m.notes,
    })),
    exams: i.exams.map((e) => ({
      id: e.id,
      title: e.title,
      date: iso(e.date),
      text: e.text,
      hasPdf: !!e.prototypeName,
      pdfName: e.prototypeName,
    })),
  }));

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
      {personId && <IllnessBoard personId={personId} illnesses={illnesses} />}
    </>
  );
}
