import Link from "next/link";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const greek = (d: Date) => d.toISOString().slice(0, 10).split("-").reverse().join("/");
const MONTHS = ["Ιανουαρίου", "Φεβρουαρίου", "Μαρτίου", "Απριλίου", "Μαΐου", "Ιουνίου", "Ιουλίου", "Αυγούστου", "Σεπτεμβρίου", "Οκτωβρίου", "Νοεμβρίου", "Δεκεμβρίου"];
const dayMonth = (d: Date) => `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;

// Same format as the blood-tests archive: dates (grouped by year) on the left, the selected record on the right.
export default async function ExamsArchive({ searchParams }: { searchParams: Promise<{ person?: string; id?: string }> }) {
  const sp = await searchParams;
  const persons = await prisma.person.findMany({ orderBy: { id: "asc" } });
  const personId = Number(sp.person) || persons[0]?.id;
  const exams = await prisma.generalExam.findMany({
    where: { personId },
    orderBy: [{ date: "desc" }, { id: "desc" }],
    select: { id: true, date: true, title: true },
  });
  const selectedId = exams.find((e) => e.id === Number(sp.id))?.id ?? exams[0]?.id;
  const exam = selectedId
    ? await prisma.generalExam.findUnique({
        where: { id: selectedId },
        include: { groupGen: true },
        omit: { prototype: true },
      })
    : null;
  const hasPdf = exam ? (await prisma.generalExam.count({ where: { id: exam.id, prototype: { not: null } } })) > 0 : false;

  return (
    <>
      <h1>Αρχείο</h1>
      <form className="row">
        <select name="person" defaultValue={personId}>
          {persons.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <button type="submit">Εμφάνιση</button>
      </form>
      {exams.length === 0 ? (
        <p className="muted">Δεν υπάρχουν εγγραφές.</p>
      ) : (
        <div className="split">
          <aside className="card dates">
            {exams.map((e, i) => [
              (i === 0 || e.date.getUTCFullYear() !== exams[i - 1].date.getUTCFullYear()) && (
                <div className="yr" key={`y${e.date.getUTCFullYear()}`}>{e.date.getUTCFullYear()}</div>
              ),
              <Link key={e.id} href={`/exams/archive?person=${personId}&id=${e.id}`} className={e.id === selectedId ? "active" : ""}>
                {dayMonth(e.date)} <span className="muted">({e.title})</span>
              </Link>,
            ])}
          </aside>

          <section className="card tablewrap">
            {exam && (
              <>
                <h2>
                  {greek(exam.date)} · {exam.title}{" "}
                  {exam.groupGen && <span className="muted small">{exam.groupGen.name}</span>}
                </h2>
                {exam.text &&
                  (exam.textIsHtml ? (
                    <div dangerouslySetInnerHTML={{ __html: exam.text }} />
                  ) : (
                    <p style={{ whiteSpace: "pre-wrap" }}>{exam.text}</p>
                  ))}
                {exam.analysis && (
                  <>
                    <h3>Ανάλυση</h3>
                    <p style={{ whiteSpace: "pre-wrap" }}>{exam.analysis}</p>
                  </>
                )}
                {hasPdf && (
                  <p>
                    <a className="btn" href={`/api/general-exam/${exam.id}`} target="_blank" rel="noreferrer">
                      Άνοιγμα PDF{exam.prototypeName ? ` (${exam.prototypeName})` : ""}
                    </a>
                  </p>
                )}
              </>
            )}
          </section>
        </div>
      )}
    </>
  );
}
