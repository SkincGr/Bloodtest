"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

// A row of links; the one whose path matches the current page (or one of its `also` paths) is highlighted.
export type NavItem = { href: string; label: string; also?: string[] };

export default function NavLinks({ items, className }: { items: NavItem[]; className?: string }) {
  const path = usePathname();
  const on = (i: NavItem) =>
    [i.href, ...(i.also ?? [])].some((h) => (h === "/" ? path === "/" : path === h || path.startsWith(h + "/")));
  return (
    <nav className={className}>
      {items.map((i) => (
        <Link key={i.href} href={i.href} className={on(i) ? "active" : ""}>
          {i.label}
        </Link>
      ))}
    </nav>
  );
}
