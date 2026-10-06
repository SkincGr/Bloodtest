// Item "codes" are the Latin abbreviations in BloodItem names ("PSA - Ειδικό…", "RBC Ερυθρά…", "Τ4 - Θυροξίνη")
// and in the lab's result rows ("Ερυθρά Αιμοσφαίρια (RBC)"). Used to pair a PDF row with an item.

// Uppercase Greek letters that look like Latin ones ("Τ4" is often Greek Tau + 4).
const LOOK: Record<string, string> = {
  Α: "A", Β: "B", Ε: "E", Ζ: "Z", Η: "H", Ι: "I", Κ: "K", Μ: "M", Ν: "N", Ο: "O", Ρ: "P", Τ: "T", Υ: "Y", Χ: "X",
};
const latinize = (s: string) => s.replace(/[Α-Ω]/g, (c) => LOOK[c] ?? c);

// Canonical form used to compare codes: "RDW-CV" == "RDW - CV" == "rdwcv".
export const codeKey = (s: string) =>
  latinize(s).toUpperCase().replace(/[^A-Z0-9%#]/g, "");

// A token is code-like when it is pure ASCII after latinizing and carries a Latin letter, digit, % or #
// (so a Greek word made only of look-alike letters, e.g. "ΟΥΡΙΑ", is not mistaken for a code).
function isCode(tok: string): boolean {
  const t = latinize(tok);
  return /^[A-Za-z0-9%#\-+/]+$/.test(t) && /[A-Za-z0-9%#]/.test(t) && /[A-Za-z]|\d|[%#]/.test(tok.replace(/[Α-Ω]/g, ""));
}

// Codes found in an item name, e.g. "SGOT - AST" -> ["SGOT", "AST"], "Lactate Dehydrogenase (LDH)" -> ["LDH"].
export function extractCodes(name: string): string[] {
  const inParens = [...name.matchAll(/\(([^)]*)\)/g)].map((m) => m[1]);
  const pool = inParens.length ? inParens.join(" ") : name;
  const out: string[] = [];
  for (const raw of pool.split(/[\s,;]+/)) {
    const tok = raw.replace(/^[(\-]+|[)\-.]+$/g, "");
    if (tok && !/^[%#]+$/.test(tok) && isCode(tok) && !out.includes(tok)) out.push(tok);
  }
  return out;
}

// Codes printed in a result row's label: text inside (...) plus a trailing unbalanced "PSA)".
// Whole parenthesis content ("RDW - CV") and its separate words ("HDL Chol" -> HDL, Chol) are all candidates.
export function rowCodes(label: string): string[] {
  const parts = [...label.matchAll(/\(([^)]*)\)/g)].map((m) => m[1]);
  const open = label.match(/([^\s(]+)\)\s*$/);
  if (open && !/\(/.test(label.slice(label.lastIndexOf(open[1])))) parts.push(open[1]);
  const keys = new Set<string>();
  for (const p of parts) {
    const whole = codeKey(p);
    if (whole) keys.add(whole);
    for (const w of p.split(/[\s,;]+/)) {
      const k = codeKey(w);
      if (k) keys.add(k);
    }
  }
  // Some labs print the code first instead of in parentheses: "RBC Ερυθρά αιμοσφαίρια", "SGOT", "Τ4 - Θυροξίνη".
  // Only when the code stands for the whole row: "LDH 1 (Heart)" / "LDH 2" are isoenzymes, not the total "LDH".
  const words = label.trim().split(/[\s:]+/);
  const first = words[0] ?? "";
  const standsAlone = !label.includes("(") && !/^\d+$/.test(words[1] ?? "");
  if (standsAlone && first.length >= 2 && isCode(first) && /^[A-ZΑ-Ω0-9%#\-+]+$/.test(first)) keys.add(codeKey(first));
  return [...keys];
}

// Item.code is stored as "SGOT, AST"; compare by key.
export const itemCodeKeys = (code: string | null | undefined): string[] =>
  (code ?? "").split(",").map(codeKey).filter(Boolean);
