"use client";
import { useState } from "react";
import { extractPdfText } from "@/lib/pdf";
import { parseText, type ParsedPdf } from "@/lib/parser";

type Person = { id: number; name: string; mrn: string | null };
type Item = { id: number; name: string };
type Entry = {
  file: string;
  parsed?: ParsedPdf;
  error?: string;
  personId: number | "";
  date: string;
  values: { itemId: number; name: string; value: number; on: boolean }[];
  status?: string;
  saving?: boolean;
};

export default function Uploader({ persons, items }: { persons: Person[]; items: Item[] }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const patch = (i: number, p: Partial<Entry>) =>
    setEntries((es) => es.map((e, j) => (j === i ? { ...e, ...p } : e)));

  async function onFiles(files: FileList | null) {
    if (!files) return;
    const out: Entry[] = [];
    for (const f of Array.from(files)) {
      try {
        const parsed = parseText(await extractPdfText(f), items);
        const person = persons.find((p) => p.mrn && p.mrn === parsed.mrn);
        out.push({
          file: f.name,
          parsed,
          personId: person?.id ?? "",
          date: parsed.date ?? "",
          values: parsed.values.map((v) => ({ ...v, on: true })),
        });
      } catch (e) {
        out.push({ file: f.name, error: String(e), personId: "", date: "", values: [] });
      }
    }
    setEntries(out);
  }

  async function save(i: number) {
    const e = entries[i];
    patch(i, { saving: true, status: undefined });
    const r = await fetch("/api/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        personId: e.personId,
        mrn: e.parsed?.mrn,
        date: e.date,
        values: e.values.filter((v) => v.on).map((v) => ({ itemId: v.itemId, value: v.value })),
      }),
    });
    const j = await r.json();
    patch(i, {
      saving: false,
      status: r.ok ? `Αποθηκεύτηκαν ${j.inserted}, υπήρχαν ήδη ${j.skipped}` : `Σφάλμα: ${j.error}`,
    });
  }

  const setValue = (i: number, k: number, p: Partial<Entry["values"][number]>) =>
    patch(i, { values: entries[i].values.map((x, y) => (y === k ? { ...x, ...p } : x)) });

  return (
    <>
      <div className="card">
        <input type="file" accept=".pdf,application/pdf" multiple
          onChange={(e) => onFiles(e.target.files)} />
        <p className="muted">Τα PDF διαβάζονται στον browser σου· στη βάση στέλνονται μόνο οι τιμές.</p>
      </div>

      {entries.map((e, i) => (
        <div className="card" key={i}>
          <h2>{e.file}</h2>
          {e.error && <p className="bad">{e.error}</p>}
          {e.parsed && (
            <>
              <div className="row">
                <label>Πρόσωπο{" "}
                  <select value={e.personId}
                    onChange={(ev) => patch(i, { personId: ev.target.value ? Number(ev.target.value) : "" })}>
                    <option value="">— επιλογή —</option>
                    {persons.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </label>
                <label>Ημερομηνία{" "}
                  <input type="date" value={e.date} onChange={(ev) => patch(i, { date: ev.target.value })} />
                </label>
                <span className="muted">MRN: {e.parsed.mrn ?? "—"}</span>
              </div>

              {e.values.length === 0 ? (
                <p className="muted">Δεν βρέθηκαν γνωστές εξετάσεις σε αυτό το PDF.</p>
              ) : (
                <div className="tablewrap">
                  <table>
                    <thead><tr><th></th><th>Εξέταση</th><th className="num">Τιμή</th></tr></thead>
                    <tbody>
                      {e.values.map((v, k) => (
                        <tr key={v.itemId}>
                          <td><input type="checkbox" checked={v.on}
                            onChange={(ev) => setValue(i, k, { on: ev.target.checked })} /></td>
                          <td>{v.name}</td>
                          <td className="num"><input type="number" step="any" value={v.value}
                            onChange={(ev) => setValue(i, k, { value: Number(ev.target.value) })} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {e.parsed.notFound.length > 0 && (
                <p className="muted">Βρέθηκε το όνομα αλλά όχι τιμή: {e.parsed.notFound.join(", ")}</p>
              )}
              <div className="row" style={{ marginTop: 12 }}>
                <button disabled={e.saving || !e.personId || !e.date || !e.values.some((v) => v.on)}
                  onClick={() => save(i)}>
                  {e.saving ? "Αποθήκευση…" : "Εισαγωγή στη βάση"}
                </button>
                {e.status && <span className={e.status.startsWith("Σφάλμα") ? "bad" : "ok"}>{e.status}</span>}
              </div>
            </>
          )}
        </div>
      ))}
    </>
  );
}
