import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = { title: "Εξετάσεις Αίματος" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="el">
      <body>
        <nav>
          <strong>Εξετάσεις Αίματος</strong>
          <Link href="/">Εισαγωγή PDF</Link>
          <Link href="/history">Ιστορικό</Link>
        </nav>
        <main>{children}</main>
      </body>
    </html>
  );
}
