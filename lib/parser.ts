// Pure text -> values parser (no DOM / Node deps) so it runs in the browser and in tests.

// The lab's PDFs use a custom Greek font encoding; extracted text comes out as these glyphs.
const CHARMAP: Record<string, string> = {
  ǹ: "Α", Ǻ: "Β", ī: "Γ", ǻ: "Δ", Ǽ: "Ε", ǽ: "Ζ", Ǿ: "Η", Ĭ: "Θ", ǿ: "Ι", Ȁ: "Κ", ȁ: "Λ", Ȃ: "Μ", ȃ: "Ν", Ȅ: "Ξ", ȅ: "Ο", Ȇ: "Π", ȇ: "Ρ", Ȉ: "Σ", ȉ: "Τ", Ȋ: "Υ", ĭ: "Φ", ȋ: "Χ", Ȍ: "Ψ", ȍ: "Ω",
  Į: "α", ȕ: "β", Ȗ: "γ", į: "δ", İ: "ε", ȗ: "ζ", Ș: "η", ș: "θ", Ț: "ι", ț: "κ", Ȝ: "λ", ȝ: "μ", Ȟ: "ν", ȟ: "ξ", Ƞ: "ο", ʌ: "π", ȡ: "ρ", ı: "σ", Ȣ: "ς", Ĳ: "τ", ȣ: "υ", ĳ: "φ", Ȥ: "χ", ȥ: "ψ", Ȧ: "ω",
  Ȑ: "ά", ȑ: "έ", Ȓ: "ή", ȓ: "ί", ȩ: "ό", Ȫ: "ύ", ȫ: "ώ",
  ǵ: "ό", ȧ: "ΐ", Ǹ: "ΐ", Ǳ: "Ά",
};

import { ALIASES, type Alias } from "./aliases";
import { itemCodeKeys, rowCodes } from "./itemCode";

export function decodeText(text: string): string {
  let out = "";
  for (const ch of text) out += CHARMAP[ch] ?? ch;
  return out;
}

export type ItemRef = { id: number; name: string; code?: string | null };
// Rectangle on a PDF page, in PDF units (y = bottom edge); page is 0-based.
export type Box = { page: number; x: number; y: number; w: number; h: number };
export type ParsedValue = { itemId: number; name: string; value: number; boxes?: Box[] };
export type PdfPage = { width: number; items: { s: string; x: number; y: number; w?: number; h?: number }[] };
export type Unmatched = { label: string; value: number; range?: string; boxes?: Box[] };
// A row for a known exam that has reference limits but no value in the text layer: the lab drew the value as a
// vector shape (out-of-range values are printed in bold this way). `region` is where the value sits, for OCR.
export type Missing = { itemId: number; name: string; range?: string; region: Box; boxes: Box[] };
export type ParsedPdf = {
  missing: Missing[];
  unmatched: Unmatched[]; // result rows no alias/item recognised
  mrn: string | null;
  date: string | null; // YYYY-MM-DD
  values: ParsedValue[];
  notFound: string[]; // item names with no number found
};

// Lowercase, drop accents and whitespace so "Αιμοσφαιρίνη" matches "ΑΙΜΟΣΦΑΙΡΙΝΗ" and wrapped lines.
const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/ς/g, "σ")
    .replace(/[\s\u0000-\u001f]+/g, ""); // the PDF font encodes spaces/hyphens as control chars (\u0003, \u0010)

export function findMrn(text: string): string | null {
  return text.match(/MRN:?\s*(\d+)/)?.[1] ?? null;
}

// First dd/mm/yyyy that is not the birth date.
export function findDate(text: string): string | null {
  for (const line of text.split("\n")) {
    if (norm(line).includes("γεννησ")) continue;
    const m = line.match(/(?<![\d/])(\d{1,2})\/(\d{1,2})\/(\d{4})(?!\d)/); // also "17/9/2026"
    if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    // this lab prints dd/mm/yy ("25/06/26")
    const m2 = line.match(/(?<![\d/])(\d{2})\/(\d{2})\/(\d{2})(?![\d/])/);
    if (m2) return `20${m2[3]}-${m2[2]}-${m2[1]}`;
  }
  return null;
}

export function parseText(rawText: string, items: ItemRef[]): ParsedPdf {
  const text = decodeText(rawText);
  const flat = norm(text);

  // All occurrences of every item name.
  type Hit = { item: ItemRef; start: number; end: number };
  const hits: Hit[] = [];
  for (const item of items) {
    const n = norm(item.name);
    if (!n) continue;
    for (let i = flat.indexOf(n); i !== -1; i = flat.indexOf(n, i + 1))
      hits.push({ item, start: i, end: i + n.length });
  }
  // Drop hits fully inside a longer item's hit ("Χοληστερόλη" inside "HDL Χοληστερόλη").
  const real = hits.filter(
    (h) =>
      !hits.some(
        (o) =>
          o !== h &&
          o.end - o.start > h.end - h.start &&
          o.start <= h.start &&
          o.end >= h.end,
      ),
  );

  const values: ParsedValue[] = [];
  const notFound: string[] = [];
  const done = new Set<number>();
  for (const h of real.sort((a, b) => a.start - b.start)) {
    if (done.has(h.item.id)) continue;
    // The value may follow after method text, so look ahead a bit.
    const after = flat.slice(h.end, h.end + 150);
    const m = after.match(/(\d+\.\d+|\d+(?:,\d+)?)/);
    const value = m ? parseFloat(m[1].replace(",", ".")) : NaN;
    if (!m || !isFinite(value) || value > 3000) continue; // >3000 is likely a year/phone
    // A number that starts a range ("4.5-5.5") or follows < / > is a reference limit, not a result.
    if (/^-\d/.test(after.slice(m.index! + m[0].length)) || /[<>]$/.test(after.slice(0, m.index!))) continue;
    done.add(h.item.id);
    values.push({ itemId: h.item.id, name: h.item.name, value });
  }
  for (const item of items)
    if (!done.has(item.id) && real.some((h) => h.item.id === item.id))
      notFound.push(item.name);

  return { mrn: findMrn(text), date: findDate(text), values, notFound, unmatched: [], missing: [] };
}

// --- Row-based parsing (uses text positions, so labels stay paired with their values) ---

// norm() plus Greek letters that look like Latin ones -> one alphabet, so "ΒιταμίνηΒ12" == "Βιταμίνηb12".
const LOOKALIKE: Record<string, string> = {
  α: "a", β: "b", ε: "e", ζ: "z", η: "h", ι: "i", κ: "k", μ: "m", ν: "n", ο: "o", ρ: "p", τ: "t", υ: "y", χ: "x",
};
export const skel = (s: string) => norm(s).replace(/[α-ω]/g, (c) => LOOKALIKE[c] ?? c);

// A result cell: a number, optionally followed by its unit in the same cell ("95 mg/dl", "32.0%").
// Ranges such as "4.5 - 5.5" don't match.
const NUM = /^\d+(?:[.,]\d+)?(?:\s*[%A-Za-zΑ-Ωα-ωμ/].*)?$/;

// The font encodes spaces and hyphens as control chars (\u0003, \u0010); make them readable again.
const tidy = (s: string) =>
  s.replace(/\u0003/g, " ").replace(/\u0010/g, "-").replace(/[\u0000-\u001f]/g, "").replace(/\s+/g, " ").trim();

// A printed reference range: "0.12-0.35", "<0.5", ">3".
const RANGE = /^(?:[<>]=?\s*\d+(?:[.,]\d+)?|\d+(?:[.,]\d+)?\s*-\s*\d+(?:[.,]\d+)?)$/;

type Cell = { s: string; x: number; y: number; w: number; h: number };
type Row = Cell[];

function groupRows(items: PdfPage["items"]): Row[] {
  const sorted = items
    .filter((t) => t.s.trim())
    .map((t) => ({ s: tidy(decodeText(t.s)), x: t.x, y: t.y, w: t.w ?? 0, h: t.h ?? 9 }))
    .sort((a, b) => b.y - a.y || a.x - b.x);
  const rows: { y: number; cells: Row }[] = [];
  for (const it of sorted) {
    const r = rows[rows.length - 1];
    if (r && Math.abs(r.y - it.y) < 3) r.cells.push(it);
    else rows.push({ y: it.y, cells: [it] });
  }
  return rows.map((r) => r.cells.sort((a, b) => a.x - b.x));
}

// Tight rectangle around some cells of one row (small padding so text is not clipped).
function boxOf(page: number, cells: Cell[]): Box | null {
  if (!cells.length) return null;
  const x0 = Math.min(...cells.map((c) => c.x));
  const x1 = Math.max(...cells.map((c) => c.x + c.w));
  const h = Math.max(...cells.map((c) => c.h));
  const y = cells[0].y;
  return { page, x: x0 - 2, y: y - 0.25 * h - 1, w: x1 - x0 + 4, h: h * 1.2 + 2 };
}

export function parsePages(pages: PdfPage[], items: ItemRef[]): Pick<ParsedPdf, "values" | "unmatched" | "missing"> {
  const known = new Set(items.map((i) => i.id));
  const nameOf = new Map(items.map((i) => [i.id, i.name]));
  const values: ParsedValue[] = [];
  const unmatched: Unmatched[] = [];
  const missing: Missing[] = [];
  const done = new Set<number>();

  // code key -> item ids ("RBC" -> [11]); a code shared by several items is ambiguous and ignored.
  const byCode = new Map<string, number[]>();
  for (const it of items)
    for (const k of itemCodeKeys(it.code)) byCode.set(k, [...(byCode.get(k) ?? []), it.id]);

  const resolve = (label: string): Alias[] => {
    const key = skel(label);
    const viaAlias = ALIASES.filter(
      (a) => known.has(a.item) && a.match.every((m) => key.includes(skel(m))) && !(a.not ?? []).some((n) => key.includes(skel(n))),
    );
    if (viaAlias.length) return viaAlias;
    const ids = new Set<number>();
    for (const k of rowCodes(label)) if (byCode.get(k)?.length === 1) ids.add(byCode.get(k)![0]);
    return ids.size === 1 ? [{ item: [...ids][0], match: [] }] : [];
  };

  // `miss`: set when the row already shows reference limits, so a value should be there.
  type Pending = { hit: Alias[]; label: string; box: Box | null; y: number; miss?: { region: Box; range?: string } };
  type Held = { pend: Pending; v: Cell[]; row: Row };

  for (const [pageIdx, page] of pages.entries()) {
    const valueX = page.width * 0.33; // result column starts about a third across the page
    let pending: Pending | null = null; // a label row without a value (the value is on the next row)
    let held: Held | null = null; // a value whose label had no code; the "(CODE)" line may follow it

    const assign = (hit: Alias[], v: Cell[], extra: (Box | null)[]) => {
      for (const a of hit) {
        const c = v[a.index ?? 0];
        if (!c || done.has(a.item)) continue;
        done.add(a.item);
        const boxes = [...extra, boxOf(pageIdx, [c])].filter((b): b is Box => !!b);
        values.push({ itemId: a.item, name: nameOf.get(a.item)!, value: parseFloat(c.s.replace(",", ".")), boxes });
      }
    };
    const addUnmatched = (label: string, v: Cell[], row: Row, extra: (Box | null)[]) => {
      const at = row.indexOf(v[0]);
      const next = row[at + 1];
      // Skip page footers / addresses ("1 / 1", e-mail, phone numbers).
      if (!next || next.s === "/" || next.s.includes("@") || !/[Α-Ωα-ωA-Za-z]{3}/.test(label) || /Τηλ|Κιν/.test(label)) return;
      unmatched.push({
        label: label.replace(/(?:[\s.:]*[.:]){2,}.*$/, "").trim(), // drop the "........:" filler
        value: parseFloat(v[0].s.replace(",", ".")),
        range: row.slice(at + 1).find((c) => RANGE.test(c.s))?.s.replace(/\s+/g, ""),
        boxes: [...extra, boxOf(pageIdx, [v[0]])].filter((b): b is Box => !!b),
      });
    };
    const flushHeld = () => {
      if (held) addUnmatched(held.pend.label, held.v, held.row, [held.pend.box]);
      held = null;
    };
    // A label row nobody gave a value to: if it has limits and is a known exam, the value is drawn as a shape.
    const dropPending = () => {
      const p = pending;
      pending = null;
      if (!p?.miss || p.hit.length !== 1) return;
      const item = p.hit[0].item;
      missing.push({
        itemId: item,
        name: nameOf.get(item)!,
        range: p.miss.range,
        region: p.miss.region,
        boxes: [p.box, p.miss.region].filter((b): b is Box => !!b),
      });
    };

    for (const cells of groupRows(page.items)) {
      const v = cells.filter((c) => c.x >= valueX && NUM.test(c.s));
      const y = cells[0].y;
      // A row that starts in the value column is the value line of the label row just above it.
      const valueOnly = !!pending && v.length > 0 && cells[0] === v[0] && pending.y - y < 45;
      if (pending && !valueOnly) dropPending();
      if (cells[0].x > page.width * 0.25 && !valueOnly) continue; // not a result row

      const labelCells = cells.filter((c) => !v.length || c.x < v[0].x);
      const label = labelCells.map((c) => c.s).join(" ");

      if (!v.length) {
        if (held) {
          // The lab prints some codes under the value: label / value / "(PSA)".
          const code = held.pend.y - y < 45 ? resolve(label) : [];
          if (code.length) {
            assign(code, held.v, [held.pend.box, boxOf(pageIdx, labelCells)]);
            held = null;
            pending = null;
            continue;
          }
          flushHeld();
        }
        pending = label ? { hit: resolve(label), label, box: boxOf(pageIdx, labelCells), y } : null;
        // Where the value would be: after the label text, before the first unit / limits cell.
        const rangeCell = cells.find((c) => RANGE.test(c.s));
        const tail = cells.find((c) => c.x >= valueX);
        if (pending && rangeCell && tail) {
          const left = Math.max(...cells.filter((c) => c.x < valueX).map((c) => c.x + c.w)) + 2;
          // Text row baseline = y. The bold value (a ~5pt-high shape) sits from ~1pt below to ~4.2pt above it;
          // stay inside that band so letters of the rows above/below (8.7pt apart) are not included.
          const region: Box = { page: pageIdx, x: left, y: y - 1.2, w: tail.x - 0.3 - left, h: 5.8 };
          if (region.w > 4) pending.miss = { region, range: rangeCell.s.replace(/\s+/g, "") };
        }
        continue;
      }

      flushHeld();
      if (valueOnly) {
        const p = pending!;
        pending = null;
        if (p.hit.length) assign(p.hit, v, [p.box]);
        else held = { pend: p, v, row: cells };
        continue;
      }
      pending = null;
      const hit = resolve(label);
      if (hit.length) assign(hit, v, [boxOf(pageIdx, labelCells)]);
      else addUnmatched(label, v, cells, [boxOf(pageIdx, labelCells)]);
    }
    flushHeld();
    if (pending) dropPending();
  }
  return {
    values: values.filter((x) => isFinite(x.value) && x.value <= 3000),
    unmatched,
    missing: missing.filter((m) => !done.has(m.itemId)),
  };
}

// Row-based result first; name matching over the plain text fills anything the rows missed.
export function parsePdf(rawText: string, pages: PdfPage[], items: ItemRef[]): ParsedPdf {
  const byText = parseText(rawText, items);
  const byRows = parsePages(pages, items);
  const have = new Set(byRows.values.map((v) => v.itemId));
  const values = [...byRows.values, ...byText.values.filter((v) => !have.has(v.itemId))];
  const got = new Set(values.map((v) => v.itemId));
  return {
    ...byText,
    values,
    unmatched: byRows.unmatched,
    missing: byRows.missing.filter((m) => !got.has(m.itemId)),
    notFound: byText.notFound.filter((n) => !values.some((v) => v.name === n)),
  };
}
