import NavLinks from "@/components/NavLinks";

export default function WeightLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <NavLinks className="subnav" items={[{ href: "/weight", label: "Γράφημα" }]} />
      <main>{children}</main>
    </>
  );
}
