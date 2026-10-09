"use client";
import { useState } from "react";
import EditGeneralExam, { type EditableExam } from "./EditGeneralExam";

// Buttons under the text of a record: [Ανάλυση] [Εμφάνιση Προτύπου] [Επεξεργασία].
// Ανάλυση / Πρότυπο toggle a panel below the buttons; Επεξεργασία opens a full-screen card.
export default function ExamActions({
  exam,
  analysisHtml,
  persons,
  groups,
}: {
  exam: EditableExam;
  analysisHtml: string; // already sanitized on the server
  persons: { id: number; name: string }[];
  groups: { id: number; name: string }[];
}) {
  const [panel, setPanel] = useState<"analysis" | "pdf" | null>(null);
  const [editing, setEditing] = useState(false);
  const toggle = (p: "analysis" | "pdf") => setPanel(panel === p ? null : p);

  return (
    <>
      <div className="row" style={{ marginTop: 14 }}>
        <button type="button" className={panel === "analysis" ? "" : "ghost"} aria-expanded={panel === "analysis"}
          onClick={() => toggle("analysis")}>
          Ανάλυση
        </button>
        <button type="button" className={panel === "pdf" ? "" : "ghost"} aria-expanded={panel === "pdf"}
          disabled={!exam.hasPdf} title={exam.hasPdf ? undefined : "Δεν υπάρχει πρότυπο (PDF)"}
          onClick={() => toggle("pdf")}>
          Εμφάνιση Προτύπου
        </button>
        <button type="button" className="ghost" onClick={() => setEditing(true)}>Επεξεργασία</button>
      </div>

      {panel === "analysis" && (
        <div style={{ borderTop: "1px solid var(--line)", paddingTop: 8 }}>
          <h3 style={{ marginTop: 0 }}>Ανάλυση</h3>
          {analysisHtml ? <div dangerouslySetInnerHTML={{ __html: analysisHtml }} /> : <p className="muted">Δεν υπάρχει ανάλυση.</p>}
        </div>
      )}
      {panel === "pdf" && exam.hasPdf && (
        <div style={{ borderTop: "1px solid var(--line)", paddingTop: 8 }}>
          <p className="muted small" style={{ marginTop: 0 }}>
            {exam.pdfName}{" "}
            <a href={`/api/general-exam/${exam.id}`} target="_blank" rel="noreferrer">Άνοιγμα σε νέα καρτέλα ↗</a>
          </p>
          <iframe src={`/api/general-exam/${exam.id}`} title="Πρότυπο (PDF)"
            style={{ width: "100%", height: "75vh", border: "1px solid var(--line)", borderRadius: 6 }} />
        </div>
      )}

      <EditGeneralExam exam={exam} persons={persons} groups={groups} open={editing} onClose={() => setEditing(false)} />
    </>
  );
}
