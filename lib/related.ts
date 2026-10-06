// Which exams are looked at together. When one is out of range, the doctor usually checks the others
// in the same group. General guidance only - edit freely (or have your doctor adjust it).
//
// A reference is an item id (the Access Item_AID kept in the database) or, for exams added later from
// the import page, its code (e.g. "PCT"), matched against BloodItem.code.
// `members` are related to each other; `also` are shown for the members but don't point back.
import { codeKey, itemCodeKeys } from "./itemCode";

type Ref = number | string;
type Rule = { title: string; members: Ref[]; also?: Ref[] };

export const RELATED_RULES: Rule[] = [
  { title: "Ερυθρά / αναιμία", members: [11, 16, 21, 22, 18, 19, 15], also: [47, 40, 39, 6, 26, 3] }, // RBC HGB HCT MCV MCH MCHC RDW + Fe Ferritin B12 Folic CRP Creatinine
  { title: "Σίδηρος, B12, φυλλικό", members: [47, 40, 39, 6], also: [16, 21, 22, 18, 15] },
  { title: "Λευκά και τύπος λευκών", members: [9, 20, 4, 17, 32, 5, 30, 2, 1], also: [26, 29] }, // WBC NE LY MO EO BA + CRP ESR
  { title: "Αιμοπετάλια", members: [37, 12, 60, 54, "PCT"], also: [16, 9] }, // PLT MPV PDW PCT + HGB WBC
  { title: "Νεφρική λειτουργία", members: [3, 14, 7, 36, 44] }, // Creatinine Urea K Na Uric acid
  { title: "Ήπαρ / χοληφόρα", members: [42, 43, 53, 25, 23, 51, 8, 41, 33] }, // AST ALT γGT ALP Bilirubin Proteins
  { title: "Μύες", members: [28, 45, 46, 55, 35, "ALD"], also: [42, 3] }, // CPK LDH Aldolase + AST Creatinine
  { title: "Σάκχαρο", members: [50, 10, 48, 56, 57] }, // Glucose HbA1c
  { title: "Λιπίδια", members: [38, 27, 49, 58] }, // Cholesterol HDL LDL Triglycerides
  { title: "Θυρεοειδής", members: [31, 52, 34, "FT4"] }, // TSH T4 T3 FT4
  { title: "Φλεγμονή", members: [26, 29], also: [9, 20] }, // CRP ESR + WBC NE%
  { title: "Βιταμίνη D / ασβέστιο", members: [59, 13] },
];

type ItemLike = { id: number; code: string | null };

function resolve(ref: Ref, all: ItemLike[]): number[] {
  if (typeof ref === "number") return all.some((i) => i.id === ref) ? [ref] : [];
  const key = codeKey(ref);
  return all.filter((i) => itemCodeKeys(i.code).includes(key)).map((i) => i.id);
}

// Related exams of `itemId`, grouped by rule; each exam appears once (in its first group).
export function relatedTo(itemId: number, all: ItemLike[]): { title: string; ids: number[] }[] {
  const seen = new Set<number>([itemId]);
  const out: { title: string; ids: number[] }[] = [];
  for (const rule of RELATED_RULES) {
    const members = rule.members.flatMap((r) => resolve(r, all));
    if (!members.includes(itemId)) continue;
    const ids = [...members, ...(rule.also ?? []).flatMap((r) => resolve(r, all))].filter((id) => {
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
    if (ids.length) out.push({ title: rule.title, ids });
  }
  return out;
}
