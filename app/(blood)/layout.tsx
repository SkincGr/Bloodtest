import NavLinks from "@/components/NavLinks";

export default function BloodLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <NavLinks
        className="subnav"
        items={[
          { href: "/tests", label: "Αρχείο" },
          { href: "/history", label: "Πίνακας" },
          { href: "/outliers", label: "Εκτός ορίων" },
          { href: "/frequency", label: "Συχνότητα" },
          { href: "/", label: "Εισαγωγή PDF" },
        ]}
      />
      <main>{children}</main>
    </>
  );
}
