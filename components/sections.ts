import type { NavItem } from "./NavLinks";

// The app's sections: each is one item of the main menu and has its own sub menu.
// `paths` are the pages that belong to the section (the section is highlighted on any of them).
export type Section = { href: string; label: string; paths: string[]; sub: NavItem[] };

export const SECTIONS: Section[] = [
  {
    href: "/illnesses",
    label: "Ιστορικό",
    paths: ["/illnesses"],
    sub: [],
  },
  {
    href: "/tests",
    label: "Εξετάσεις Αίματος",
    paths: ["/tests", "/", "/import", "/history", "/outliers", "/frequency", "/trends"],
    sub: [
      { href: "/tests", label: "Αρχείο" },
      { href: "/history", label: "Πίνακας" },
      { href: "/outliers", label: "Εκτός ορίων" },
      { href: "/frequency", label: "Συχνότητα" },
      { href: "/import", label: "Export/Import" },
    ],
  },
  {
    href: "/exams/archive",
    label: "Εξετάσεις",
    paths: ["/exams"],
    sub: [
      { href: "/exams/archive", label: "Αρχείο" },
      { href: "/exams/import", label: "Εισαγωγή" },
    ],
  },
  {
    href: "/weight",
    label: "Εξέλιξη Βάρους",
    paths: ["/weight"],
    sub: [{ href: "/weight", label: "Γράφημα" }],
  },
];

export const inSection = (s: Section, path: string) =>
  s.paths.some((h) => (h === "/" ? path === "/" : path === h || path.startsWith(h + "/")));
