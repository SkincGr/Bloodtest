"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { extractPdfText } from "@/lib/pdf";
import { parseText, type ParsedPdf } from "@/lib/parser";

type Person = { id: number; name: string; mrn: string | null };
type Item = { id: number; name: string };
type Entry = {
  file: string;
  url: string; // object URL for the preview iframe
  parsed?: ParsedPdf;
  error?: string;
  personId: number | "";
  date: string;
  values: { itemId: number; name: string; value: number; on: boolean }[];
  status?: { ok: boolean; text: string };
  saving?: boolean;
};

export default function Uploader({ persons, items }: { persons: Person[]; items: Item[] }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [cur, setCur] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const urls = useRef<string[]>([]);

  useEffect(() => () => urls.current.forEach(URL.revokeObjectURL), []);

  const patch = (i: number, p: Partial<Entry>) =>
    setEntries((es) => es.map((e, j) => (j === i ? { ...e, ...p } : e)));
  const setValue = (i: number, k: number, p: Partial<Entry["values"][number]>) =>
    patch(i, { values: entries[i].values.map((x, y) => (y === k ? { ...x, ...p } : x)) });

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    urls.current.forEach(URL.revokeObjectURL);
    urls.current = [];
    const out: Entry[] = [];
    for (const f of Array.from(files)) {
      const url = URL.createObjectURL(f);
      urls.current.push(url);
      try {
        const parsed = parseText(await extractPdfText(f), items);
        const person = persons.find((p) => p.mrn && p.mrn === parsed.mrn);
        out.push({
          file: f.name,
          url,
          parsed,
          personId: person?.id ?? "",
          date: parsed.date ?? "",
          values: parsed.values.map((v) => ({ ...v, on: true })),
        });
      } catch (e) {
        out.push({ file: f.name, url, error: String(e), personId: "", date: "", values: [] });
      }
    }
    setEntries(out);
    setCur(0);
    setConfirming(false);
  }

  async function save() {
    const e = entries[cur];
    setConfirming(false);
    patch(cur, { saving: true, status: undefined });
    try {
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
      patch(cur, {
        saving: false,
        status: r.ok
          ? { ok: true, text: `Αποθηκεύτηκαν ${j.inserted}, υπήρχαν ήδη ${j.skipped}` }
          : { ok: false, text: `Σφάλμα: ${j.error}` },
      });
    } catch {
      patch(cur, { saving: false, status: { ok: false, text: "Σφάλμα δικτύου" } });
    }
  }

  const e = entries[cur];
  const person = e && persons.find((p) => p.id === e.personId);
  const chosen = e ? e.values.filter((v) => v.on).length : 0;
  const isLast = cur === entries.length - 1;
  const goto = (i: number) => {
    setCur(i);
    setConfirming(false);
  };

  return (
    <>
      <div className="card">
        <input type="file" accept=".pdf,application/pdf" multiple
          onChange={(ev) => onFiles(ev.target.files)} />
        <p className="muted">Τα PDF διαβάζονται στον browser σου· στη βάση στέλνονται μόνο οι τιμές.</p>
      </div>

      {e && (
        <>
          <div className="row">
            <strong>{e.file}</strong>
            <span className="muted">Αρχείο {cur + 1} από {entries.length}</span>
          </div>
          <div className="split2">
            <div className="card pdfpane">
              <iframe src={e.url} title={e.file} />
            </div>

            <div className="card">
              <h2>Αυτά που διάβασε το πρόγραμμα</h2>
              {e.error && <p className="bad">{e.error}</p>}
              {e.parsed && (
                <>
                  <div className="row">
                    <label>Πρόσωπο{" "}
                      <select value={e.personId}
                        onChange={(ev) => patch(cur, { personId: ev.target.value ? Number(ev.target.value) : "" })}>
                        <option value="">— επιλογή —</option>
                        {persons.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </label>
                    <label>Ημερομηνία{" "}
                      <input type="date" value={e.date} onChange={(ev) => patch(cur, { date: ev.target.value })} />
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
                                onChange={(ev) => setValue(cur, k, { on: ev.target.checked })} /></td>
                              <td>{v.name}</td>
                              <td className="num"><input type="number" step="any" value={v.value}
                                onChange={(ev) => setValue(cur, k, { value: Number(ev.target.value) })} /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {e.parsed.notFound.length > 0 && (
                    <p className="muted">Βρέθηκε το όνομα αλλά όχι τιμή: {e.parsed.notFound.join(", ")}</p>
                  )}

                  {/* Step 1: review, Step 2: confirm, Step 3: saved -> next file */}
                  {!e.status?.ok && !confirming && (
                    <div className="row" style={{ marginTop: 12 }}>
                      <button disabled={e.saving || !e.personId || !e.date || chosen === 0}
                        onClick={() => setConfirming(true)}>
                        Εισαγωγή στη βάση
                      </button>
                      {!isLast && <button className="ghost" onClick={() => goto(cur + 1)}>Παράλειψη</button>}
                      {e.saving && <span className="muted">Αποθήκευση…</span>}
                    </div>
                  )}

                  {confirming && (
                    <div className="confirm">
                      <p>
                        Είναι όλα εντάξει; Θα αποθηκευτούν <strong>{chosen}</strong> τιμές για{" "}
                        <strong>{person?.name}</strong> με ημερομηνία <strong>{e.date.split("-").reverse().join("/")}</strong>.
                      </p>
                      <div className="row">
                        <button onClick={save}>Ναι, αποθήκευση</button>
                        <button className="ghost" onClick={() => setConfirming(false)}>Όχι, επιστροφή</button>
                      </div>
                    </div>
                  )}

                  {e.status && (
                    <div className="row" style={{ marginTop: 12 }}>
                      <span className={e.status.ok ? "ok" : "bad"}>{e.status.text}</span>
                      {e.status.ok && !isLast && <button onClick={() => goto(cur + 1)}>Επόμενο PDF →</button>}
                      {e.status.ok && isLast && <Link href="/tests">Δες τα αποτελέσματα →</Link>}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
