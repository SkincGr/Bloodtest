"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import RichTextField from "./RichTextField";

export type EditableExam = {
  id: number;
  personId: number;
  date: string; // YYYY-MM-DD
  title: string;
  text: string | null;
  analysis: string | null;
  groupId: number | null;
  hasPdf: boolean;
  pdfName: string | null;
};

// ✏️ button that opens the edit form of a GeneralExam record (same fields as the create form).
export default function EditGeneralExam({
  exam,
  persons,
  groups,
}: {
  exam: EditableExam;
  persons: { id: number; name: string }[];
  groups: { id: number; name: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/general-exam/${exam.id}`, { method: "PATCH", body: new FormData(form) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? "Αποτυχία αποθήκευσης");
      const person = form.querySelector<HTMLSelectElement>("[name=person]")!.value;
      setOpen(false);
      if (Number(person) !== exam.personId) router.push(`/exams/archive?person=${person}&id=${exam.id}`);
      else router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Αποτυχία αποθήκευσης");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button type="button" className="ghost" onClick={() => setOpen(!open)} aria-expanded={open}
        title="Επεξεργασία" aria-label="Επεξεργασία">
        ✏️ Επεξεργασία
      </button>
      {open && (
        <form className="card addform" onSubmit={submit} style={{ marginTop: 8 }}>
          <label>Πρόσωπο
            <select name="person" required defaultValue={exam.personId}>
              {persons.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <label>Ημερομηνία
            <input type="date" name="date" required defaultValue={exam.date} />
          </label>
          <label>Τίτλος
            <input name="title" required maxLength={300} defaultValue={exam.title} />
          </label>
          <label>Ομάδα
            <select name="group" defaultValue={exam.groupId ?? ""}>
              <option value="">— καμία —</option>
              {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </label>
          <RichTextField name="text" label="Κείμενο" initialHtml={exam.text ?? ""} minHeight={160} />
          <RichTextField name="analysis" label="Ανάλυση" initialHtml={exam.analysis ?? ""} minHeight={110} />
          <label>{exam.hasPdf ? "Αντικατάσταση PDF" : "Πρωτότυπο (PDF)"}
            <input type="file" name="prototype" accept="application/pdf,.pdf" />
          </label>
          {exam.hasPdf && (
            <label className="relchk">
              <input type="checkbox" name="removePdf" /> Αφαίρεση του τρέχοντος PDF{exam.pdfName ? ` (${exam.pdfName})` : ""}
            </label>
          )}
          <div className="row">
            <button type="submit" disabled={busy}>{busy ? "Αποθήκευση…" : "Αποθήκευση"}</button>
            <button type="button" className="ghost" onClick={() => setOpen(false)}>Άκυρο</button>
            {error && <span className="bad">{error}</span>}
          </div>
        </form>
      )}
    </>
  );
}
