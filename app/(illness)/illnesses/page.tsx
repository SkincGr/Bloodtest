import Link from "next/link";
import { prisma } from "@/lib/db";
import { sanitizeHtml } from "@/lib/sanitizeHtml";
import HistoryEditor from "@/components/HistoryEditor";
import CreateAnalysisButton from "@/components/CreateAnalysisButton";
import DeleteReportButton from "@/components/DeleteReportButton";

export const dynamic = "force-dynamic";

const MONTHS = ["Ιανουάριος", "Φεβρουάριος", "Μάρτιος", "Απρίλιος", "Μάιος", "Ιούνιος", "Ιούλιος", "Αύγουστος", "Σεπτέμβριος", "Οκτώβριος", "Νοέμβριος", "Δεκέμβριος"];

// "α/α μήνας έτος", e.g. "3 Οκτώβριος 2026" (month and year in Greek time)
function reportTitle(seq: number, at: Date) {
  const [y, m] = at.toLocaleDateString("sv-SE", { timeZone: "Europe/Athens" }).split("-");
  return `${seq} ${MONTHS[Number(m) - 1]} ${y}`;
}

export default async function History({ searchParams }: { searchParams: Promise<{ person?: string; report?: string }> }) {
  const sp = await searchParams;
  const persons = await prisma.person.findMany({ orderBy: { id: "asc" } });
  const personId = Number(sp.person) || persons[0]?.id;

  const [history, reports] = personId
    ? await Promise.all([
        prisma.personHistory.findUnique({ where: { personId } }),
        prisma.healthReport.findMany({ where: { personId }, orderBy: { seq: "desc" }, select: { id: true, seq: true, createdAt: true } }),
      ])
    : [null, []];

  const selected = reports.find((r) => r.id === Number(sp.report));
  const report = selected ? await prisma.healthReport.findUnique({ where: { id: selected.id } }) : null;

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
        {personId && <CreateAnalysisButton personId={personId} />}
      </form>

      <div className="split">
        <aside className="card dates toc">
          <Link href={`/illnesses?person=${personId}`} className={"yr" + (!report ? " active" : "")}>Ιστορικό</Link>
          <div className="yr">Health Analysis</div>
          {reports.length === 0 && <span className="muted small" style={{ padding: "4px 18px" }}>Καμία αναφορά ακόμα</span>}
          {reports.map((r) => (
            <Link key={r.id} href={`/illnesses?person=${personId}&report=${r.id}`} className={r.id === report?.id ? "active" : ""}>
              {reportTitle(r.seq, r.createdAt)}
            </Link>
          ))}
        </aside>

        <section style={{ minWidth: 0 }}>
          {report ? (
            <div className="card" style={{ margin: 0 }}>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <h2 style={{ margin: 0 }}>Health Analysis · {reportTitle(report.seq, report.createdAt)}</h2>
                <DeleteReportButton id={report.id} personId={personId!} title={reportTitle(report.seq, report.createdAt)} />
              </div>
              <p className="muted small">
                Δημιουργήθηκε {report.createdAt.toLocaleString("el-GR", { timeZone: "Europe/Athens" })}
                {report.model ? ` · ${report.model}` : ""} · Ενημερωτικό κείμενο, δεν αντικαθιστά τον γιατρό.
              </p>
              <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(report.html) }} />
            </div>
          ) : (
            personId && <HistoryEditor key={personId} personId={personId} initialHtml={history?.html ?? ""} />
          )}
        </section>
      </div>
    </>
  );
}
