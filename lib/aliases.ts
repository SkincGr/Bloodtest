// Maps a result row's label (as printed by the lab) to a BloodItem id.
// `match`: every string must occur in the label; `not`: none may occur.
// Comparison ignores case, accents, spaces and Greek/Latin look-alike letters (see skel() in parser.ts).
// `index`: which numeric value of the row to use (0 = first). Differential rows print "% value" first
// and the absolute count second, e.g. Neutrophils -> NE% (index 0), NE# (index 1).
// Item ids are the Access Item_AID values kept by prisma/seed.ts.
export type Alias = { item: number; match: string[]; not?: string[]; index?: number };

export const ALIASES: Alias[] = [
  // Αιματολογικό
  { item: 11, match: ["(RBC)"] }, // RBC Ερυθρά αιμοσφαίρια
  { item: 16, match: ["(HGB)"] }, // HGB Αιμοσφαιρίνη
  { item: 21, match: ["(HCT)"] }, // HCT Αιματοκρίτης
  { item: 22, match: ["(MCV)"] }, // MCV
  { item: 18, match: ["(MCH)"] }, // MCH
  { item: 19, match: ["(MCHC)"] }, // MCHC
  { item: 15, match: ["(RDW-CV)"] }, // RDW-CV
  { item: 9, match: ["(WBC)"] }, // WBC Λευκά
  { item: 20, match: ["(NEUT)"], index: 0 }, // NE%
  { item: 4, match: ["(NEUT)"], index: 1 }, // NE#
  { item: 17, match: ["(LYM)"], index: 0 }, // LY%
  { item: 32, match: ["(LYM)"], index: 1 }, // LY#
  { item: 5, match: ["(MONO)"], index: 0 }, // MO%
  { item: 30, match: ["(MONO)"], index: 1 }, // MO#
  { item: 2, match: ["(EOS)"], index: 0 }, // EO%
  { item: 1, match: ["(BASO)"], index: 0 }, // BA%
  { item: 37, match: ["(PLT)"] }, // PLT Αιμοπετάλια
  { item: 12, match: ["MPV"] }, // MPV (και το 60 έχει τον ίδιο κωδικό, γι' αυτό ρητή αντιστοίχιση)
  { item: 54, match: ["(PDW)"] }, // PDW
  { item: 29, match: ["ΤαχύτηταΚαθίζησηςΕρυθρών"] }, // ΤΚΕ

  // Εργαστήριο MEDILAB (κωδικός στην αρχή της γραμμής, τιμή και μονάδα μαζί)
  { item: 20, match: ["NEUT%"] }, // NE%
  { item: 4, match: ["NEUT#"] }, // NE#
  { item: 17, match: ["LYM%"] }, // LY%
  { item: 32, match: ["LYM#"] }, // LY#
  { item: 5, match: ["MM%"] }, // MO%
  { item: 30, match: ["MM#"] }, // MO#
  { item: 2, match: ["EO%"] }, // EO%
  { item: 1, match: ["BAS%"] }, // BA%
  { item: 15, match: ["RDW"] }, // RDW-CV
  { item: 50, match: ["Σάκχαρο"] }, // Σάκχαρο - Glu
  { item: 38, match: ["Χοληστερίνη"], not: ["HDL", "LDL"] }, // Cholesterol
  { item: 58, match: ["Τριγλυκερίδια"] },
  { item: 59, match: ["Βιταμίνη", "25-OH"] }, // 25-OH D3

  { item: 23, match: ["Χολερυθρίνη", "Αμεση"] }, // ΧΟΛΕΡΥΘΡΙΝΗ ΑΜΕΣΟΣ

  // Βιοχημικό
  { item: 26, match: ["CRP"] }, // CRP
  { item: 7, match: ["Κάλιο"] },
  { item: 36, match: ["Νάτριο"] },
  { item: 14, match: ["Ουρία"] },
  { item: 50, match: ["(GLU)"] }, // Σάκχαρο
  { item: 3, match: ["Κρεατινίνη"], not: ["φωσφο"] },
  { item: 44, match: ["Ουρικό"] },
  { item: 43, match: ["SGPT"] }, // ALT
  { item: 42, match: ["SGOT"] }, // AST
  { item: 53, match: ["Γλουταμυλοτρανσφεράση"] }, // γGT
  { item: 35, match: ["(LDH)"] },
  { item: 25, match: ["Φωσφατάση", "αλκαλική"] }, // ALP
  { item: 28, match: ["(CPK)"] }, // "CPK" (the item the existing history uses)
  { item: 13, match: ["Ασβέστιο"] },
  { item: 47, match: ["Σίδηρος"] },
  { item: 40, match: ["Φερριτίνη"] },
  { item: 39, match: ["ΒιταμίνηΒ"] }, // B12
  { item: 59, match: ["ΒιταμίνηD"] }, // 25-OH D3
  { item: 6, match: ["Φυλλικόοξύ"] },
  { item: 48, match: ["ΟλικήΑιμοσφαιρίνηΑ"] }, // HbA1

  // Λιπίδια
  { item: 38, match: ["(Chol)"] },
  { item: 38, match: ["(TC)"] },
  { item: 27, match: ["(HDL"] },
  { item: 49, match: ["(LDL"] },
  { item: 58, match: ["(TGs)"] },
  { item: 58, match: ["(Trigl)"] },

  // Ορμόνες / όγκοι
  { item: 31, match: ["(TSH)"] },
  { item: 52, match: ["Θυροξίνη"], not: ["Ελεύθερη", "FT4"] }, // T4
  { item: 24, match: ["PSA)"] }, // PSA (η τιμή είναι στην επόμενη γραμμή «Μέθοδος…»)
  { item: 24, match: ["ΠροστατικόΑντιγόνο"] }, // PSA: στα πλήρη PDF ο κωδικός «(PSA)» είναι κάτω από την τιμή
];
