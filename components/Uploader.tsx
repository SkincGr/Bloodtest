"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { extractPdf } from "@/lib/pdf";
import { parsePdf, type Box, type ParsedPdf } from "@/lib/parser";
import PdfViewer, { type Mark } from "@/components/PdfViewer";
import { suggestItem } from "@/lib/newItem";

type Person = { id: number; name: string; mrn: string | null };
type Item = { id: number; name: string; code: string | null };
type Group = { id: number; name: string };
// Form for adding a PDF row that matched no exam to BloodItems.
type NewItem = { k: number; name: string; code: string; groupId: number | ""; range: string; busy?: boolean; error?: string };
type Entry = {
  file: string;
  blob: File;
  url: string; // object URL to open the PDF in its own tab
  parsed?: ParsedPdf;
  error?: string;
  personId: number | "";
  date: string;
  values: { itemId: number; name: string; value: number; on: boolean; boxes?: Box[] }[];
  status?: { ok: boolean; text: string };
  saving?: boolean;
};

export default function Uploader({
  persons,
  groups,
  items,
}: {
  persons: Person[];
  groups: Group[];
  items: Item[];
}) {
  const [knownItems, setKnownItems] = useState<Item[]>(items); // grows when the user adds exams
  const [adding, setAdding] = useState<NewItem | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [cur, setCur] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const [existing, setExisting] = useState<number | null>(null); // values already in the DB for this person + date
  const [active, setActive] = useState<{ id: string; n: number }>();
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
        const { text, pages } = await extractPdf(f);
        const parsed = parsePdf(text, pages, knownItems);
        const person = persons.find((p) => p.mrn && p.mrn === parsed.mrn);
        out.push({
          file: f.name,
          blob: f,
          url,
          parsed,
          personId: person?.id ?? "",
          date: parsed.date ?? "",
          values: parsed.values.map((v) => ({ ...v, on: true })),
        });
      } catch (e) {
        out.push({ file: f.name, blob: f, url, error: String(e), personId: "", date: "", values: [] });
      }
    }
    setEntries(out);
    setCur(0);
    setConfirming(false);
  }

  // Importing replaces everything stored for that person + date, so count it first and show it in the question.
  async function askConfirm() {
    const e = entries[cur];
    setExisting(null);
    setConfirming(true);
    try {
      const r = await fetch(`/api/import?personId=${e.personId}&date=${e.date}`);
      const j = await r.json();
      setExisting(r.ok ? j.count : 0);
    } catch {
      setConfirming(false);
      patch(cur, { status: { ok: false, text: "Σφάλμα δικτύου" } });
    }
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
          ? { ok: true, text: `Αποθηκεύτηκαν ${j.inserted} τιμές` + (j.deleted ? ` (διαγράφηκαν ${j.deleted} παλιές)` : "") }
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
    setActive(undefined);
    setAdding(null);
  };

  function startAdding(k: number) {
    const u = entries[cur]?.parsed?.unmatched[k];
    if (!u) return;
    const s = suggestItem(u.label);
    setAdding({ k, name: s.name, code: s.code, groupId: "", range: u.range ?? "" });
  }

  // 1) add the exam to BloodItems, 2) put the PDF value into this file's list so "Εισαγωγή" saves the test.
  async function addItem() {
    if (!adding || !e?.parsed || adding.groupId === "") return;
    const u = e.parsed.unmatched[adding.k];
    setAdding({ ...adding, busy: true, error: undefined });
    try {
      const r = await fetch("/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: adding.name, code: adding.code, groupId: adding.groupId, range: adding.range }),
      });
      const j = await r.json();
      if (!r.ok) return setAdding({ ...adding, busy: false, error: j.error ?? "Σφάλμα" });
      setKnownItems((ks) => [...ks, j]);
      patch(cur, {
        values: [...e.values, { itemId: j.id, name: j.name, value: u.value, on: true, boxes: u.boxes }],
        parsed: { ...e.parsed, unmatched: e.parsed.unmatched.filter((_, i) => i !== adding.k) },
      });
      setAdding(null);
      setActive({ id: "v" + j.id, n: (active?.n ?? 0) + 1 });
    } catch {
      setAdding({ ...adding, busy: false, error: "Σφάλμα δικτύου" });
    }
  }

  const select = (id: string) => {
    setActive((a) => ({ id, n: (a?.n ?? 0) + 1 }));
    if (id[0] === "u") startAdding(Number(id.slice(1)));
  };

  // Rectangles drawn over the PDF: green = matched, grey = matched but unchecked, orange = not matched.
  const marks: Mark[] = e
    ? [
        ...e.values.flatMap((v): Mark[] =>
          v.boxes?.length ? [{ id: "v" + v.itemId, boxes: v.boxes, kind: v.on ? "ok" : "off", title: `${v.name}: ${v.value}` }] : [],
        ),
        ...(e.parsed?.unmatched ?? []).flatMap((u, k): Mark[] =>
          u.boxes?.length ? [{ id: "u" + k, boxes: u.boxes, kind: "unmatched", title: `Δεν αντιστοιχίστηκε: ${u.label} = ${u.value}` }] : [],
        ),
      ]
    : [];

  // Clicking a rectangle in the PDF scrolls the table to its row.
  useEffect(() => {
    if (active) document.querySelector(`[data-row="${active.id}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [active]);

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
            <div>
              <div className="legend">
                <span><i style={{ background: "rgba(34,197,94,.6)" }} />αντιστοιχίστηκε</span>
                <span><i style={{ background: "rgba(148,163,184,.6)" }} />δεν θα αποθηκευτεί</span>
                <span><i style={{ background: "rgba(245,158,11,.6)" }} />δεν αντιστοιχίστηκε</span>
                <a href={e.url} target="_blank" rel="noreferrer">Άνοιγμα PDF ↗</a>
              </div>
              <div className="card pdfpane">
                <PdfViewer file={e.blob} marks={marks} active={active} onSelect={select} />
              </div>
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
                            <tr key={v.itemId} data-row={"v" + v.itemId}
                              className={active?.id === "v" + v.itemId ? "sel" : ""}
                              onClick={() => v.boxes?.length && select("v" + v.itemId)}>
                              <td onClick={(ev) => ev.stopPropagation()}><input type="checkbox" checked={v.on}
                                onChange={(ev) => setValue(cur, k, { on: ev.target.checked })} /></td>
                              <td>{v.name}</td>
                              <td className="num" onClick={(ev) => ev.stopPropagation()}><input type="number" step="any" value={v.value}
                                onChange={(ev) => setValue(cur, k, { value: Number(ev.target.value) })} /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {e.parsed.unmatched.length > 0 && (
                    <div className="unmatched">
                      <h2>Δεν υπάρχουν στη βάση ({e.parsed.unmatched.length})</h2>
                      {e.parsed.unmatched.map((u, k) => (
                        <div key={k} data-row={"u" + k} className={"umrow" + (active?.id === "u" + k ? " sel" : "")}>
                          <div className="row" style={{ marginBottom: adding?.k === k ? 8 : 0 }}>
                            <span>
                              {u.label}: <strong>{u.value}</strong>
                              {u.range && <span className="muted"> · όρια {u.range}</span>}
                            </span>
                            {adding?.k !== k && (
                              <button className="ghost" onClick={() => { startAdding(k); setActive((a) => ({ id: "u" + k, n: (a?.n ?? 0) + 1 })); }}>
                                Προσθήκη εξέτασης…
                              </button>
                            )}
                          </div>
                          {adding?.k === k && (
                            <div className="addform">
                              <label>Όνομα
                                <input value={adding.name} onChange={(ev) => setAdding({ ...adding, name: ev.target.value })} />
                              </label>
                              <label>Κωδικός
                                <input value={adding.code} onChange={(ev) => setAdding({ ...adding, code: ev.target.value })} />
                              </label>
                              <label>Όρια
                                <input value={adding.range} placeholder="π.χ. 0.12-0.35 ή <0.5"
                                  onChange={(ev) => setAdding({ ...adding, range: ev.target.value })} />
                              </label>
                              <label>Group
                                <select value={adding.groupId}
                                  onChange={(ev) => setAdding({ ...adding, groupId: ev.target.value ? Number(ev.target.value) : "" })}>
                                  <option value="">— επιλογή group —</option>
                                  {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                                </select>
                              </label>
                              <div className="row">
                                <button onClick={addItem} disabled={adding.busy || !adding.name.trim() || adding.groupId === ""}>
                                  {adding.busy ? "Προσθήκη…" : "Προσθήκη στη βάση και στη λίστα"}
                                </button>
                                <button className="ghost" onClick={() => setAdding(null)}>Άκυρο</button>
                                {adding.error && <span className="bad">{adding.error}</span>}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {e.parsed.notFound.length > 0 && (
                    <p className="muted">Βρέθηκε το όνομα αλλά όχι τιμή: {e.parsed.notFound.join(", ")}</p>
                  )}

                  {/* Step 1: review, Step 2: confirm, Step 3: saved -> next file */}
                  {!e.status?.ok && !confirming && (
                    <div className="row" style={{ marginTop: 12 }}>
                      <button disabled={e.saving || !e.personId || !e.date || chosen === 0}
                        onClick={askConfirm}>
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
                      {existing == null ? (
                        <p className="muted">Έλεγχος υπαρχόντων τιμών…</p>
                      ) : existing > 0 ? (
                        <p className="bad">
                          Προσοχή: για αυτή την ημερομηνία υπάρχουν ήδη {existing} τιμές στη βάση. Θα
                          <strong> διαγραφούν όλες</strong> και θα αντικατασταθούν από τις {chosen} νέες.
                        </p>
                      ) : (
                        <p className="muted">Δεν υπάρχουν άλλες τιμές για αυτή την ημερομηνία.</p>
                      )}
                      <div className="row">
                        <button onClick={save} disabled={existing == null}>
                          {existing ? "Ναι, αντικατάσταση" : "Ναι, αποθήκευση"}
                        </button>
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
