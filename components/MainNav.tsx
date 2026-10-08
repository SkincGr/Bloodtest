"use client";
import { usePathname } from "next/navigation";
import NavLinks from "./NavLinks";
import { SECTIONS, inSection } from "./sections";

// Top-level menu (the sections) and, under it, the sub menu of the current section.
export default function MainNav() {
  const path = usePathname();
  const current = SECTIONS.find((s) => inSection(s, path));
  return (
    <>
      <NavLinks
        className="mainnav"
        items={SECTIONS.map((s) => ({ href: s.href, label: s.label, also: s.paths }))}
      />
      {current && current.sub.length > 0 && <NavLinks className="subnav" items={current.sub} />}
    </>
  );
}
