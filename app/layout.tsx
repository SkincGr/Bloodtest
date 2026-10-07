import type { Metadata } from "next";
import MainNav from "@/components/MainNav";
import "./globals.css";

export const metadata: Metadata = { title: "Εξετάσεις Αίματος" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="el">
      <body>
        <MainNav />
        {children}
      </body>
    </html>
  );
}
