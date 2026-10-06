// Pure text -> values parser (no DOM / Node deps) so it runs in the browser and in tests.

// The lab's PDFs use a custom Greek font encoding; extracted text comes out as these glyphs.
const CHARMAP: Record<string, string> = {
  ǹ: "Α", Ǻ: "Β", ī: "Γ", ǻ: "Δ", Ǽ: "Ε", ǽ: "Ζ", Ǿ: "Η", Ĭ: "Θ", ǿ: "Ι", Ȁ: "Κ", ȁ: "Λ", Ȃ: "Μ", ȃ: "Ν", Ȅ: "Ξ", ȅ: "Ο", Ȇ: "Π", ȇ: "Ρ", Ȉ: "Σ", ȉ: "Τ", Ȋ: "Υ", ĭ: "Φ", ȋ: "Χ", Ȍ: "Ψ", ȍ: "Ω",
  Į: "α", ȕ: "β", Ȗ: "γ", į: "δ", İ: "ε", ȗ: "ζ", Ș: "η", ș: "θ", Ț: "ι", ț: "κ", Ȝ: "λ", ȝ: "μ", Ȟ: "ν", ȟ: "ξ", Ƞ: "ο", ʌ: "π", ȡ: "ρ", ı: "σ", Ȣ: "ς", Ĳ: "τ", ȣ: "υ", ĳ: "φ", Ȥ: "χ", ȥ: "ψ", Ȧ: "ω",
  Ȑ: "ά", ȑ: "έ", Ȓ: "ή", ȓ: "ί", ȩ: "ό", Ȫ: "ύ", ȫ: "ώ",
};

export function decodeText(text: string): string {
  let out = "";
  for (const ch of text) out += CHARMAP[ch] ?? ch;
  return out;
}

export type ItemRef = { id: number; name: string };
export type ParsedValue = { itemId: number; name: string; value: number };
export type ParsedPdf = {
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
    .replace(/\s+/g, "");

export function findMrn(text: string): string | null {
  return text.match(/MRN\s*(\d+)/)?.[1] ?? null;
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

  return { mrn: findMrn(text), date: findDate(text), values, notFound };
}
