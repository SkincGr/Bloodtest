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
export type ParsedPdf = {
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
    const m = line.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (m) return `${m[3]}-${m[2]}-${m[1]}`;
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
    done.add(h.item.id);
    values.push({ itemId: h.item.id, name: h.item.name, value });
  }
  for (const item of items)
    if (!done.has(item.id) && real.some((h) => h.item.id === item.id))
      notFound.push(item.name);

  return { mrn: findMrn(text), date: findDate(text), values, notFound, unmatched: [] };
}

// --- Row-based parsing (uses text positions, so labels stay paired with their values) ---

// norm() plus Greek letters that look like Latin ones -> one alphabet, so "ΒιταμίνηΒ12" == "Βιταμίνηb12".
const LOOKALIKE: Record<string, string> = {
  α: "a", β: "b", ε: "e", ζ: "z", η: "h", ι: "i", κ: "k", μ: "m", ν: "n", ο: "o", ρ: "p", τ: "t", υ: "y", χ: "x",
};
export const skel = (s: string) => norm(s).replace(/[α-ω]/g, (c) => LOOKALIKE[c] ?? c);

const NUM = /^\d+(?:[.,]\d+)?$/;

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

export function parsePages(pages: PdfPage[], items: ItemRef[]): Pick<ParsedPdf, "values" | "unmatched"> {
  const known = new Set(items.map((i) => i.id));
  const nameOf = new Map(items.map((i) => [i.id, i.name]));
  const values: ParsedValue[] = [];
  const unmatched: Unmatched[] = [];
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

  type Pending = { hit: Alias[]; label: string; box: Box | null; y: number };
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
        label: label.replace(/[.:]{2,}.*$/, "").trim(),
        value: parseFloat(v[0].s.replace(",", ".")),
        range: row.slice(at + 1).find((c) => RANGE.test(c.s))?.s.replace(/\s+/g, ""),
        boxes: [...extra, boxOf(pageIdx, [v[0]])].filter((b): b is Box => !!b),
      });
    };
    const flushHeld = () => {
      if (held) addUnmatched(held.pend.label, held.v, held.row, [held.pend.box]);
      held = null;
    };

    for (const cells of groupRows(page.items)) {
      const v = cells.filter((c) => c.x >= valueX && NUM.test(c.s));
      const y = cells[0].y;
      // A row that starts in the value column is the value line of the label row just above it.
      const valueOnly = !!pending && v.length > 0 && cells[0] === v[0] && pending.y - y < 45;
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
  }
  return { values: values.filter((x) => isFinite(x.value) && x.value <= 3000), unmatched };
}

// Row-based result first; name matching over the plain text fills anything the rows missed.
export function parsePdf(rawText: string, pages: PdfPage[], items: ItemRef[]): ParsedPdf {
  const byText = parseText(rawText, items);
  const byRows = parsePages(pages, items);
  const have = new Set(byRows.values.map((v) => v.itemId));
  const values = [...byRows.values, ...byText.values.filter((v) => !have.has(v.itemId))];
  return { ...byText, values, unmatched: byRows.unmatched, notFound: byText.notFound.filter((n) => !values.some((v) => v.name === n)) };
}
