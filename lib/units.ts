import { evaluate, parseRange } from "./range";

// Labs sometimes change the unit an exam is reported in. The database keeps ONE unit per exam (the one its
// reference range is in); a value reported in another unit shows up wildly out of range.
// For the exams listed here, a value that is out of range as printed but falls INSIDE the range after multiplying by
// the factor is converted to the stored unit. Keyed by BloodItem id.
type Alt = { label: string; factor: number };
export const UNIT_ALTERNATIVES: Record<number, Alt[]> = {
  52: [{ label: "µg/dL → nmol/L", factor: 12.87 }], // Τ4 (stored in nmol/L, range 60 - 165)
  34: [{ label: "ng/dL → nmol/L", factor: 0.01536 }], // Τ3 (stored in nmol/L, range 1,10 - 3,10)
};

export type Converted = { value: number; from: number; label: string };

// Tooltip text for a converted value, e.g. "Μετατράπηκε από 7,84 µg/dL σε 100,9 nmol/L".
export function convTitle(origValue: number | null, convNote: string | null, value: number): string | undefined {
  if (origValue == null || !convNote) return undefined;
  const [from, to] = convNote.split(" → ");
  return `Μετατράπηκε από ${origValue} ${from} σε ${value}${to ? " " + to : ""}`;
}

type Limits = { min: number | null; max: number | null; condition: string | null };

const round = (x: number) => Math.round(x * 10) / 10;

// Returns the converted value, or null when no conversion applies (value already in range, no rule, or no rule fits).
export function convertUnit(itemId: number, value: number, limits: Limits): Converted | null {
  const alts = UNIT_ALTERNATIVES[itemId];
  if (!alts || !evaluate(value, limits.min, limits.max, limits.condition).out) return null;
  for (const a of alts) {
    const v = round(value * a.factor);
    if (!evaluate(v, limits.min, limits.max, limits.condition).out) return { value: v, from: value, label: a.label };
  }
  return null;
}

// --- Conversion found from the reference limits the lab printed next to the result ---
// The database range of an exam is in its stored unit. If the printed limits are the same range multiplied by one
// factor (4.87-11.72 µg/dL vs 60-165 nmol/L), the lab switched units and the value is converted by that factor.
// Only factors of real unit pairs are accepted, so two labs with merely different limits never trigger it.
const KNOWN_FACTORS = [
  12.87, // T4 µg/dL → nmol/L
  65.1, // T3 nmol/L ↔ ng/dL
  18.02, // glucose mg/dL ↔ mmol/L
  38.67, // cholesterol mg/dL ↔ mmol/L
  88.57, // triglycerides mg/dL ↔ mmol/L
  88.4, // creatinine mg/dL ↔ µmol/L
  17.1, // bilirubin mg/dL ↔ µmol/L
  59.5, // uric acid mg/dL ↔ µmol/L
  5.585, // iron µg/dL ↔ µmol/L
  1.355, // vitamin B12 pg/mL ↔ pmol/L
  2.496, // vitamin D ng/mL ↔ nmol/L
  2.8, // urea mg/dL ↔ BUN mmol/L (approx.)
  10, // g/dL ↔ g/L
];
// Each pair works in both directions.
const FACTORS = KNOWN_FACTORS.flatMap((f) => [f, 1 / f]);

const nice = (x: number) => Number(x.toPrecision(4));

export type Detected = { factor: number } | { suspect: string } | null;

type ItemLimits = { min: number | null; max: number | null; condition: string | null };

// Compares the printed limits with the exam's stored limits.
//   { factor }  – same range in another unit: multiply the value by `factor`
//   { suspect } – the limits differ a lot but not by a known unit factor: do not convert, tell the user
//   null        – same unit (limits similar, or too little to compare)
export function detectFactor(printedRange: string | null | undefined, item: ItemLimits): Detected {
  const p = parseRange(printedRange);
  if (!p || p.condition !== item.condition) return null;
  const ratios: number[] = [];
  if (p.condition === "Between") {
    if (!p.min || !p.max || !item.min || !item.max) return null; // a zero or missing end can't be compared
    ratios.push(item.min / p.min, item.max / p.max);
  } else {
    const a = p.condition === "<" ? p.max : p.min;
    const b = p.condition === "<" ? item.max : item.min;
    if (!a || !b) return null;
    ratios.push(b / a);
  }
  const r = ratios.reduce((a, b) => a + b, 0) / ratios.length;
  const consistent = ratios.length === 1 || Math.abs(ratios[0] / ratios[1] - 1) <= 0.2;
  if (r >= 0.7 && r <= 1.43) return null; // similar limits: the same unit
  const known = FACTORS.find((f) => Math.abs(r / f - 1) <= 0.06);
  if (known && consistent) return { factor: known };
  if (consistent) return { suspect: `τα όρια του PDF (${printedRange}) διαφέρουν περίπου ×${nice(r)} από τα όρια της εξέτασης` };
  return null;
}

// What to store for a result: the value in the stored unit, plus the conversion record when one was applied.
export type Stored = { value: number; origValue: number | null; convNote: string | null; suspect?: string };

export function storedValue(
  itemId: number,
  value: number,
  unit: string | undefined,
  printedRange: string | undefined,
  item: ItemLimits,
): Stored {
  if (printedRange && parseRange(printedRange)) {
    const d = detectFactor(printedRange, item);
    if (d && "factor" in d) {
      const f = nice(d.factor);
      return { value: nice(value * d.factor), origValue: value, convNote: `${unit ?? "άλλη μονάδα"} → βασική μονάδα ×${f}` };
    }
    return { value, origValue: null, convNote: null, suspect: d && "suspect" in d ? d.suspect : undefined };
  }
  // No readable limits in the PDF: fall back to the fixed rules above.
  const c = convertUnit(itemId, value, item);
  return c
    ? { value: c.value, origValue: c.from, convNote: c.label }
    : { value, origValue: null, convNote: null };
}
