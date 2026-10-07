// Subgroups (υποκατηγορίες) of each Group, and which exams (BloodItem ids) belong to each.
// Applied by `npm run db:subgroups`. Safe to re-run: edit this file and run it again.
export type SubgroupDef = { id: number; groupId: number; name: string; items: number[] };

export const SUBGROUPS: SubgroupDef[] = [
  // 10 ΓΕΝ ΑΙΜΑΤΟΣ - Ερυθρά
  { id: 101, groupId: 10, name: "Ερυθρά", items: [11, 16, 21] }, // RBC, HGB, HCT
  { id: 102, groupId: 10, name: "Δείκτες ερυθρών", items: [22, 18, 19, 15] }, // MCV, MCH, MCHC, RDW
  { id: 103, groupId: 10, name: "Καθίζηση", items: [29] }, // ΤΚΕ

  // 11 ΓΕΝ ΑΙΜΑΤΟΣ - Λεμφοκύτταρα (λευκά)
  { id: 111, groupId: 11, name: "Λευκά", items: [9] }, // WBC
  { id: 112, groupId: 11, name: "Ουδετερόφιλα", items: [20, 4] },
  { id: 113, groupId: 11, name: "Λεμφοκύτταρα", items: [17, 32] },
  { id: 114, groupId: 11, name: "Μονοπύρηνα", items: [5, 30] },
  { id: 115, groupId: 11, name: "Ηωσινόφιλα - Βασεόφιλα", items: [2, 1] },

  // 12 ΓΕΝ ΑΙΜΑΤΟΣ - Αιμοπετάλια
  { id: 121, groupId: 12, name: "Αιμοπετάλια", items: [37] }, // PLT
  { id: 122, groupId: 12, name: "Δείκτες αιμοπεταλίων", items: [12, 60, 54, 61] }, // MPV, P-LCR, PDW

  // 20 ΒΙΟΧΗΜΙΚΕΣ ΕΞΕΤΑΣΕΙΣ
  { id: 201, groupId: 20, name: "Συκώτι", items: [42, 43, 53, 25, 35, 23, 62, 63] }, // SGOT, SGPT, γGT, ALP, LDH, χολερυθρίνες
  { id: 202, groupId: 20, name: "Χοληστερίνη", items: [38, 27, 49, 58, 64] },
  { id: 203, groupId: 20, name: "Σάκχαρο - Ουρία", items: [50, 14, 44] },
  { id: 204, groupId: 20, name: "Σάκχαρο - Γλυκοζυλιωμένη", items: [10, 48, 56, 57] }, // HbA1c κ.λπ.
  { id: 205, groupId: 20, name: "Θυρεοειδής", items: [31, 34, 52, 66] },
  { id: 206, groupId: 20, name: "Βιταμίνες - Σίδηρος", items: [39, 6, 59, 47, 40] },
  { id: 207, groupId: 20, name: "Μύες (CPK)", items: [28, 45, 46, 55, 65] },
  { id: 208, groupId: 20, name: "Νεφροί - Ηλεκτρολύτες", items: [3, 7, 36, 13] }, // κρεατινίνη, Κ, Na, Ca
  { id: 209, groupId: 20, name: "Πρωτεΐνες - Ούρα", items: [8, 41, 33, 51] },
  { id: 210, groupId: 20, name: "Ισοένζυμα LDH", items: [67, 68, 69, 70, 71] },

  // 30 ΟΡΜΟΝΟΛΟΓΙΚΕΣ ΕΞΕΤΑΣΕΙΣ: δεν έχει εξετάσεις ακόμα

  // 40 ΑΝΟΣΟΛΟΓΙΚΕΣ ΕΞΕΤΑΣΕΙΣ
  { id: 401, groupId: 40, name: "Φλεγμονή", items: [26] }, // CRP

  // 50 ΝΕΟΠΛΑΣΜΑΤΙΚΟΙ ΔΕΙΚΤΕΣ
  { id: 501, groupId: 50, name: "Προστάτης", items: [24] }, // PSA
];
