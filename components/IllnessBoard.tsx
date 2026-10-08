"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export type MedicationView = {
  id: number;
  title: string;
  dosage: string | null;
  fromDate: string | null;
  toDate: string | null;
  notes: string | null;
};
export type ExamView = {
  id: number;
  title: string;
  date: string | null;
  text: string | null;
  hasPdf: boolean;
  pdfName: string | null;
};
export type IllnessView = {
  id: number;
  title: string;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  medications: MedicationView[];
  exams: ExamView[];
};

const greek = (d: string | null) => (d ? d.split("-").reverse().join("/") : "");

// Sends a request, returns an error message ("" = ok).
async function send(url: string, method: "POST" | "PATCH" | "DELETE", body?: FormData | object): Promise<string> {
  try {
    const res = await fetch(url, {
      method,
      ...(body instanceof FormData
        ? { body }
        : body
          ? { body: JSON.stringify(body), headers: { "Content-Type": "application/json" } }
          : {}),
    });
    if (res.ok) return "";
    return (await res.json().catch(() => ({}))).error ?? "Αποτυχία";
  } catch {
    return "Αποτυχία σύνδεσης";
  }
}

const formJson = (form: HTMLFormElement) => Object.fromEntries(new FormData(form).entries());

// A "+" button that shows `children` (a form) below it.
function Toggle({ label, children }: { label: string; children: (close: () => void) => React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <div className="row" style={{ marginBottom: open ? 6 : 0 }}>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          title={label}
          style={{ fontSize: 18, lineHeight: 1, padding: "1px 10px" }}
        >
          {open ? "−" : "+"}
        </button>
        <span className="muted">{label}</span>
      </div>
      {open && children(() => setOpen(false))}
    </div>
  );
}

function useSubmit(onDone: () => void) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const run = async (fn: () => Promise<string>) => {
    setBusy(true);
    setError("");
    const err = await fn();
    setBusy(false);
    if (err) return setError(err);
    onDone();
    router.refresh();
  };
  return { busy, error, run };
}

function Actions({ busy, error }: { busy: boolean; error: string }) {
  return (
    <div className="row">
      <button type="submit" disabled={busy}>{busy ? "Αποθήκευση…" : "Αποθήκευση"}</button>
      {error && <span className="bad">{error}</span>}
    </div>
  );
}

function IllnessForm({ personId, edit, close }: { personId: number; edit?: IllnessView; close: () => void }) {
  const { busy, error, run } = useSubmit(close);
  return (
    <form
      className="card addform"
      onSubmit={(e) => {
        e.preventDefault();
        const f = e.currentTarget;
        run(() =>
          edit
            ? send(`/api/illness/${edit.id}`, "PATCH", formJson(f))
            : send("/api/illness", "POST", { ...formJson(f), person: personId }),
        );
      }}
    >
      <label style={{ gridColumn: "1 / -1" }}>Ασθένεια
        <input name="title" required maxLength={300} defaultValue={edit?.title} />
      </label>
      <label style={{ gridColumn: "1 / -1" }}>Περιγραφή
        <textarea name="description" rows={3} defaultValue={edit?.description ?? ""} />
      </label>
      <label>Ημερομηνία εμφάνισης
        <input type="date" name="startDate" defaultValue={edit?.startDate ?? ""} />
      </label>
      <label>Ημερομηνία περάτωσης
        <input type="date" name="endDate" defaultValue={edit?.endDate ?? ""} />
      </label>
      <Actions busy={busy} error={error} />
    </form>
  );
}

function MedicationForm({ illnessId, edit, close }: { illnessId: number; edit?: MedicationView; close: () => void }) {
  const { busy, error, run } = useSubmit(close);
  return (
    <form
      className="card addform"
      onSubmit={(e) => {
        e.preventDefault();
        const f = e.currentTarget;
        run(() =>
          edit
            ? send(`/api/medication/${edit.id}`, "PATCH", formJson(f))
            : send(`/api/illness/${illnessId}/medication`, "POST", formJson(f)),
        );
      }}
    >
      <label>Φάρμακο
        <input name="title" required maxLength={300} defaultValue={edit?.title} />
      </label>
      <label>Δοσολογία
        <input name="dosage" maxLength={300} defaultValue={edit?.dosage ?? ""} />
      </label>
      <label>Από
        <input type="date" name="fromDate" defaultValue={edit?.fromDate ?? ""} />
      </label>
      <label>Έως
        <input type="date" name="toDate" defaultValue={edit?.toDate ?? ""} />
      </label>
      <label style={{ gridColumn: "1 / -1" }}>Παρατηρήσεις
        <textarea name="notes" rows={2} defaultValue={edit?.notes ?? ""} />
      </label>
      <Actions busy={busy} error={error} />
    </form>
  );
}

function ExamForm({ illnessId, edit, close }: { illnessId: number; edit?: ExamView; close: () => void }) {
  const { busy, error, run } = useSubmit(close);
  return (
    <form
      className="card addform"
      onSubmit={(e) => {
        e.preventDefault();
        const f = e.currentTarget;
        run(() =>
          edit
            ? send(`/api/illness-exam/${edit.id}`, "PATCH", new FormData(f))
            : send(`/api/illness/${illnessId}/exam`, "POST", new FormData(f)),
        );
      }}
    >
      <label>Τίτλος
        <input name="title" required maxLength={300} defaultValue={edit?.title} />
      </label>
      <label>Ημερομηνία
        <input type="date" name="date" defaultValue={edit?.date ?? ""} />
      </label>
      <label style={{ gridColumn: "1 / -1" }}>Κείμενο (μετρήσεις)
        <textarea name="text" rows={4} defaultValue={edit?.text ?? ""} />
      </label>
      <label>{edit?.hasPdf ? "Αντικατάσταση PDF" : "ή PDF"}
        <input type="file" name="prototype" accept="application/pdf,.pdf" />
      </label>
      {edit?.hasPdf && (
        <label className="relchk">
          <input type="checkbox" name="removePdf" /> Αφαίρεση του τρέχοντος PDF{edit.pdfName ? ` (${edit.pdfName})` : ""}
        </label>
      )}
      <Actions busy={busy} error={error} />
    </form>
  );
}

function EditButton({ onClick, what }: { onClick: () => void; what: string }) {
  return (
    <button type="button" className="ghost" onClick={onClick} title={`Επεξεργασία: ${what}`} aria-label={`Επεξεργασία: ${what}`}>
      ✏️
    </button>
  );
}

function DeleteButton({ url, what }: { url: string; what: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className="ghost"
      disabled={busy}
      title={`Διαγραφή: ${what}`}
      aria-label={`Διαγραφή: ${what}`}
      onClick={async () => {
        if (!confirm(`Διαγραφή: ${what};`)) return;
        setBusy(true);
        const err = await send(url, "DELETE");
        setBusy(false);
        if (err) alert(err);
        else router.refresh();
      }}
    >
      🗑
    </button>
  );
}

function IllnessCard({ i, personId }: { i: IllnessView; personId: number }) {
  const [editing, setEditing] = useState(false);
  const [editMed, setEditMed] = useState<number | null>(null);
  const [editExam, setEditExam] = useState<number | null>(null);
  const period =
    i.startDate || i.endDate ? `${greek(i.startDate) || "?"} → ${i.endDate ? greek(i.endDate) : "συνεχίζεται"}` : "";
  return (
    <section className="card illness">
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 4 }}>
        <h2 style={{ margin: 0 }}>
          {i.title} {period && <span className="muted small">{period}</span>}
        </h2>
        <span className="row" style={{ margin: 0, gap: 4 }}>
          <EditButton onClick={() => setEditing(!editing)} what={`ασθένεια «${i.title}»`} />
          <DeleteButton url={`/api/illness/${i.id}`} what={`ασθένεια «${i.title}» με φάρμακα και εξετάσεις`} />
        </span>
      </div>
      {editing && <IllnessForm personId={personId} edit={i} close={() => setEditing(false)} />}
      {i.description && <p style={{ whiteSpace: "pre-wrap", margin: "0 0 10px" }}>{i.description}</p>}

      <h3>Φάρμακα</h3>
      {i.medications.length > 0 && (
        <div className="gridwrap" style={{ maxHeight: "none", minHeight: 0, marginBottom: 8 }}>
          <table>
            <thead>
              <tr>
                <th>Φάρμακο</th>
                <th>Δοσολογία</th>
                <th>Από</th>
                <th>Έως</th>
                <th>Παρατηρήσεις</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {i.medications.map((m) =>
                editMed === m.id ? (
                  <tr key={m.id}>
                    <td colSpan={6} style={{ whiteSpace: "normal" }}>
                      <MedicationForm illnessId={i.id} edit={m} close={() => setEditMed(null)} />
                    </td>
                  </tr>
                ) : (
                  <tr key={m.id}>
                    <td>{m.title}</td>
                    <td>{m.dosage}</td>
                    <td>{greek(m.fromDate)}</td>
                    <td>{m.toDate ? greek(m.toDate) : m.fromDate ? "συνεχίζεται" : ""}</td>
                    <td style={{ whiteSpace: "normal", minWidth: 160 }}>{m.notes}</td>
                    <td>
                      <EditButton onClick={() => setEditMed(m.id)} what={`φάρμακο «${m.title}»`} />
                      <DeleteButton url={`/api/medication/${m.id}`} what={`φάρμακο «${m.title}»`} />
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      )}
      <Toggle label="Προσθήκη φαρμάκου">{(close) => <MedicationForm illnessId={i.id} close={close} />}</Toggle>

      <h3>Εξετάσεις / Μετρήσεις</h3>
      {i.exams.map((e) =>
        editExam === e.id ? (
          <div key={e.id} style={{ borderTop: "1px solid var(--line)", padding: "6px 0" }}>
            <ExamForm illnessId={i.id} edit={e} close={() => setEditExam(null)} />
          </div>
        ) : (
        <div key={e.id} style={{ borderTop: "1px solid var(--line)", padding: "6px 0" }}>
          <div className="row" style={{ justifyContent: "space-between", margin: 0 }}>
            <strong>
              {e.title} {e.date && <span className="muted small">{greek(e.date)}</span>}
            </strong>
            <span className="row" style={{ margin: 0 }}>
              {e.hasPdf && (
                <a className="btn" href={`/api/illness-exam/${e.id}`} target="_blank" rel="noreferrer">
                  PDF{e.pdfName ? ` (${e.pdfName})` : ""}
                </a>
              )}
              <EditButton onClick={() => setEditExam(e.id)} what={`εξέταση «${e.title}»`} />
              <DeleteButton url={`/api/illness-exam/${e.id}`} what={`εξέταση «${e.title}»`} />
            </span>
          </div>
          {e.text && <p style={{ whiteSpace: "pre-wrap", margin: "4px 0 0" }}>{e.text}</p>}
        </div>
        ),
      )}
      <Toggle label="Προσθήκη εξέτασης / μέτρησης">{(close) => <ExamForm illnessId={i.id} close={close} />}</Toggle>
    </section>
  );
}

export default function IllnessBoard({ personId, illnesses }: { personId: number; illnesses: IllnessView[] }) {
  return (
    <>
      <Toggle label="Νέα ασθένεια">{(close) => <IllnessForm personId={personId} close={close} />}</Toggle>
      {illnesses.length === 0 && <p className="muted">Δεν έχει καταχωρηθεί ασθένεια.</p>}
      {illnesses.map((i) => (
        <IllnessCard key={i.id} i={i} personId={personId} />
      ))}
    </>
  );
}
