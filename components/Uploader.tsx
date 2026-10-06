"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { extractPdf, openPdf } from "@/lib/pdf";
import { ocrRegion } from "@/lib/ocr";
import { parsePdf, type Box, type Missing, type ParsedPdf } from "@/lib/parser";
import PdfViewer, { type Mark } from "@/components/PdfViewer";
import { suggestItem } from "@/lib/newItem";

type Person = { id: number; name: string; mrn: string | null };
type Item = { id: number; name: string; code: string | null };
type Group = { id: number; name: string };
// Form for adding a PDF row that matched no exam to BloodItems.
type NewItem = { k: number; name: string; code: string; groupId: number | ""; range: string; busy?: boolean; error?: string };
// A value the lab drew as a shape (not text): read by OCR, the user confirms it before it is added.
type MissRow = Missing & { state: "ocr" | "ready" | "blank"; input: string; img?: string };
type Entry = {
  missing?: MissRow[];
  file: string;
  blob: File;
  url: string; // object URL to open the PDF in its own tab
  parsed?: ParsedPdf;
  error?: string;
  personId: number | "";
  date: string;
  values: { itemId: number; name: string; value: number; on: boolean; boxes?: Box[] }[];
  status?: { ok: boolean; text: string };
  size: number; // bytes, used to be sure we delete the very same file
  del?: { state: "asking" | "busy" | "done" | "kept"; text?: string }; // "delete the PDF from your computer?" step
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
          size: f.size,
          url,
          parsed,
          personId: person?.id ?? "",
          date: parsed.date ?? "",
          values: parsed.values.map((v) => ({ ...v, on: true })),
          missing: parsed.missing.map((m) => ({ ...m, state: "ocr" as const, input: "" })),
        });
      } catch (e) {
        out.push({ file: f.name, blob: f, size: f.size, url, error: String(e), personId: "", date: "", values: [] });
      }
    }
    setEntries(out);
    setCur(0);
    setConfirming(false);
    const run = ++batch.current;
    out.forEach((e, i) => e.missing?.length && readShapes(run, i, e.blob, e.missing));
  }

  // Reads the values drawn as shapes with OCR, one file at a time, filling the inputs as results arrive.
  const batch = useRef(0);
  async function readShapes(run: number, index: number, file: File, rows: MissRow[]) {
    const upd = (id: number, p: Partial<MissRow>) =>
      setEntries((es) =>
        batch.current !== run ? es : es.map((e, j) => (j !== index ? e : { ...e, missing: e.missing?.map((m) => (m.itemId === id ? { ...m, ...p } : m)) })),
      );
    try {
      const doc = await openPdf(file);
      for (const m of rows) {
        try {
          const r = await ocrRegion(doc, m.region, m.range);
          upd(m.itemId, r && r.value != null ? { state: "ready", input: String(r.value), img: r.image } : { state: "blank", img: r?.image });
        } catch {
          upd(m.itemId, { state: "blank" });
        }
      }
    } catch {
      rows.forEach((m) => upd(m.itemId, { state: "blank" }));
    }
  }

  // The user confirmed (or typed) the value: it becomes a normal row of the import list.
  function addShape(m: MissRow) {
    const v = Number(m.input.replace(",", "."));
    if (!m.input.trim() || !isFinite(v) || !e) return;
    patch(cur, {
      values: [...e.values, { itemId: m.itemId, name: m.name, value: v, on: true, boxes: m.boxes }],
      missing: e.missing?.filter((x) => x.itemId !== m.itemId),
    });
    setActive({ id: "v" + m.itemId, n: (active?.n ?? 0) + 1 });
  }
  const dropShape = (m: MissRow) => patch(cur, { missing: e?.missing?.filter((x) => x.itemId !== m.itemId) });
  const setShape = (m: MissRow, input: string) =>
    patch(cur, { missing: e?.missing?.map((x) => (x.itemId === m.itemId ? { ...x, input } : x)) });

  // Deleting a local file needs the File System Access API (Chrome / Edge); other browsers can't do it.
  const canDelete = typeof window !== "undefined" && "showDirectoryPicker" in window;
  const dirRef = useRef<any>(null); // folder the user allowed us to delete from; reused for the next PDFs

  // The user picks the folder holding the PDF; we delete only a file with the same name AND size.
  async function deleteFile(i: number) {
    const e = entries[i];
    patch(i, { del: { state: "busy" } });
    try {
      if (!dirRef.current)
        dirRef.current = await (window as any).showDirectoryPicker({ id: "bloodtest-pdfs", mode: "readwrite" });
      let handle;
      try {
        handle = await dirRef.current.getFileHandle(e.file);
      } catch {
        dirRef.current = null; // wrong folder: forget it so the next try asks again
        return patch(i, { del: { state: "asking", text: `Δεν βρέθηκε το «${e.file}» σε αυτόν τον φάκελο. Διάλεξε τον φάκελο που είναι το PDF.` } });
      }
      if ((await handle.getFile()).size !== e.size) {
        dirRef.current = null;
        return patch(i, { del: { state: "asking", text: "Βρέθηκε αρχείο με το ίδιο όνομα αλλά διαφορετικό μέγεθος· δεν το έσβησα." } });
      }
      await dirRef.current.removeEntry(e.file);
      patch(i, { del: { state: "done", text: "Το αρχείο διαγράφηκε από τον υπολογιστή σου." } });
    } catch (err: any) {
      // AbortError = the user closed the folder picker.
      patch(i, { del: err?.name === "AbortError" ? { state: "asking" } : { state: "asking", text: `Δεν διαγράφηκε: ${err?.message ?? err}` } });
    }
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
        del: r.ok ? { state: canDelete ? "asking" : "kept", text: canDelete ? undefined : "Σβήσε το αρχείο χειροκίνητα (ο browser σου δεν επιτρέπει διαγραφή)." } : undefined,
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
        ...(e.missing ?? []).map((m): Mark => ({ id: "m" + m.itemId, boxes: m.boxes, kind: "missing", title: `${m.name}: τιμή-σχήμα (OCR)` })),
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
                {!!e.missing?.length && <span><i style={{ background: "rgba(168,85,247,.6)" }} />τιμή σε εικόνα (OCR)</span>}
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
                  {!!e.missing?.length && (
                    <div className="unmatched">
                      <h2>Τιμές που είναι εικόνα στο PDF ({e.missing.length})</h2>
                      <p className="muted small" style={{ marginTop: 0 }}>
                        Το εργαστήριο τυπώνει κάποιες τιμές (συνήθως τις εκτός ορίων, με έντονα γράμματα) ως σχήμα, όχι ως κείμενο.
                        Τις διάβασα από την εικόνα· <strong>έλεγξε ότι είναι σωστές</strong> και πάτα «Προσθήκη».
                      </p>
                      {e.missing.map((m) => (
                        <div key={m.itemId} data-row={"m" + m.itemId} className={"umrow" + (active?.id === "m" + m.itemId ? " sel" : "")}
                          onClick={() => setActive((a) => ({ id: "m" + m.itemId, n: (a?.n ?? 0) + 1 }))}>
                          <div className="row" style={{ marginBottom: 0 }}>
                            <span style={{ minWidth: 190 }}>
                              {m.name.replace(/\s+/g, " ")}
                              {m.range && <span className="muted"> · όρια {m.range}</span>}
                            </span>
                            {m.img && <img src={m.img} alt="" className="shape" />}
                            {m.state === "ocr" ? (
                              <span className="muted">Διαβάζω…</span>
                            ) : (
                              <>
                                <input type="number" step="any" value={m.input} placeholder={m.state === "blank" ? "κενό" : ""}
                                  onClick={(ev) => ev.stopPropagation()} onChange={(ev) => setShape(m, ev.target.value)} />
                                <button disabled={!m.input.trim()} onClick={(ev) => { ev.stopPropagation(); addShape(m); }}>Προσθήκη</button>
                                <button className="ghost" onClick={(ev) => { ev.stopPropagation(); dropShape(m); }}>Αγνόηση</button>
                                {m.state === "blank" && <span className="muted small">δεν βρέθηκε τιμή (κενό;)</span>}
                              </>
                            )}
                          </div>
                        </div>
                      ))}
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
                      {e.status.ok && isLast && <Link href="/tests">Άνοιγμα στο Αρχείο →</Link>}
                    </div>
                  )}

                  {e.status?.ok && e.del && (
                    <div className="confirm">
                      {(e.del.state === "asking" || e.del.state === "busy") && (
                        <>
                          <p>Θέλεις να διαγράψω το αρχείο <strong>{e.file}</strong> από τον υπολογιστή σου;</p>
                          <div className="row">
                            <button disabled={e.del.state === "busy"} onClick={() => deleteFile(cur)}>
                              {e.del.state === "busy" ? "Διαγραφή…" : "Ναι, διαγραφή"}
                            </button>
                            <button className="ghost" disabled={e.del.state === "busy"}
                              onClick={() => patch(cur, { del: { state: "kept", text: "Το αρχείο έμεινε στη θέση του." } })}>
                              Όχι, κράτα το
                            </button>
                          </div>
                          <p className="muted" style={{ margin: 0 }}>
                            Θα σου ζητηθεί να διαλέξεις τον φάκελο που βρίσκεται το PDF και να επιτρέψεις την πρόσβαση.
                          </p>
                        </>
                      )}
                      {e.del.text && <p className={e.del.state === "done" ? "ok" : "muted"} style={{ margin: "8px 0 0" }}>{e.del.text}</p>}
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
