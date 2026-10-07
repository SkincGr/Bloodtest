"use client";
import NavLinks from "./NavLinks";

const BLOOD = ["/", "/tests", "/history", "/outliers", "/frequency", "/trends"];

// Top-level menu: the two sections of the app, each with its own sub menu (see the route-group layouts).
export default function MainNav() {
  return (
    <NavLinks
      className="mainnav"
      items={[
        { href: "/tests", label: "Εξετάσεις Αίματος", also: BLOOD },
        { href: "/weight", label: "Εξέλιξη Βάρους" },
      ]}
    />
  );
}
