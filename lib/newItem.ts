import { extractCodes } from "./itemCode";

// Real codes are upper-case abbreviations ("PCT", "FT4"); words like "(Heart)" are not.
const isAbbrev = (t: string) => /^[A-Z][A-Z0-9%#\-+]*$/.test(t);

// Suggests a BloodItem name and code for a result row the lab printed, e.g.
// "Αιμοπεταλιοκρίτης (PCT)" -> { code: "PCT", name: "PCT Αιμοπεταλιοκρίτης" }.
// The user can edit both before saving, so this only has to be a good first guess.
export function suggestItem(label: string): { name: string; code: string } {
  const clean = label.replace(/\s+/g, " ").trim();
  const paren = clean.match(/\(([^)]*)\)/);
  const open = paren ? null : clean.match(/([^\s(]+)\)\s*$/);
  const trailing = paren || open ? null : clean.match(/\s([A-Z][A-Z0-9]+)$/); // "Αλδολάση- ALD"

  let codes: string[] = [];
  let base = clean;
  if (paren) {
    codes = extractCodes(`(${paren[1]})`).filter(isAbbrev);
    if (codes.length) base = clean.replace(paren[0], "");
  } else if (open) {
    codes = [open[1]].filter(isAbbrev);
    if (codes.length) base = clean.replace(open[0], "");
  } else if (trailing && isAbbrev(trailing[1])) {
    codes = [trailing[1]];
    base = clean.slice(0, trailing.index);
  }
  base = base.replace(/[\s,.:\-]+$/, "").trim();
  const code = codes.join(", ");
  return { code, name: code ? `${codes[0]} ${base}`.trim() : clean };
}
