"use client";
import Link from "next/link";
import { useState } from "react";
import RichTextField from "./RichTextField";

type Person = { id: number; name: string };
type Group = { id: number; name: string };

// "+" button that opens the form for a new GeneralExam record.
export default function NewGeneralExam({ persons, groups }: { persons: Person[]; groups: Group[] }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState<{ id: number; person: string } | null>(null);
  const [group, setGroup] = useState("");
  const [formKey, setFormKey] = useState(0); // remounts the editors after a save

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/general-exam", { method: "POST", body: new FormData(form) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? "Αποτυχία αποθήκευσης");
      const person = form.querySelector<HTMLSelectElement>("[name=person]")!.value;
      setSaved({ id: j.id, person });
        setGroup("");
      setFormKey((k) => k + 1);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Αποτυχία αποθήκευσης");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="row">
        <button type="button" onClick={() => { setOpen(!open); setSaved(null); }} aria-expanded={open}
          title="Νέα εγγραφή" style={{ fontSize: 22, lineHeight: 1, padding: "2px 12px" }}>
          {open ? "−" : "+"}
        </button>
        <span className="muted">Νέα εγγραφή</span>
        {saved && (
          <span className="ok">
            Αποθηκεύτηκε ·{" "}
            <Link href={`/exams/archive?person=${saved.person}&id=${saved.id}`}>άνοιγμα στο Αρχείο</Link>
          </span>
        )}
      </div>

      {open && (
        <form className="card addform" onSubmit={submit}>
          <label>Πρόσωπο
            <select name="person" required>
              {persons.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <label>Ημερομηνία
            <input type="date" name="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
          </label>
          <label>Τίτλος
            <input name="title" required maxLength={300} />
          </label>
          <label>Ομάδα
            <select name="group" value={group} onChange={(e) => setGroup(e.target.value)}>
              <option value="">— καμία —</option>
              {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </label>
          <RichTextField key={`t${formKey}`} name="text" label="Κείμενο" minHeight={160} />
          <RichTextField key={`a${formKey}`} name="analysis" label="Ανάλυση" minHeight={110} />
          <label>Πρωτότυπο (PDF)
            <input type="file" name="prototype" accept="application/pdf,.pdf" />
          </label>
          <div className="row">
            <button type="submit" disabled={busy}>{busy ? "Αποθήκευση…" : "Αποθήκευση"}</button>
            {error && <span className="bad">{error}</span>}
          </div>
        </form>
      )}
    </>
  );
}
