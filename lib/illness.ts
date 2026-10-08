import { NextResponse } from "next/server";

export const MAX_PDF = 4 * 1024 * 1024; // stays below the ~4.5 MB request limit of Vercel functions

export const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

export const clean = (v: unknown, max = 5000) => (typeof v === "string" ? v.trim().slice(0, max) : "");

// "YYYY-MM-DD" -> Date, "" -> null, anything else -> undefined (invalid)
export function day(v: unknown): Date | null | undefined {
  const s = clean(v, 10);
  if (!s) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s)) ? new Date(s) : undefined;
}

export const intId = async (params: Promise<{ id: string }>) => {
  const n = Number((await params).id);
  return Number.isInteger(n) && n > 0 ? n : 0;
};

// Reads an optional PDF upload; returns an error message when it is too big or not a PDF.
export async function readPdf(file: FormDataEntryValue | null) {
  if (!(file instanceof File) || file.size === 0) return { data: null, name: null, error: "" };
  if (file.size > MAX_PDF) return { data: null, name: null, error: "Το PDF είναι πάνω από 4 MB" };
  const data = new Uint8Array(await file.arrayBuffer());
  if (new TextDecoder().decode(data.subarray(0, 5)) !== "%PDF-")
    return { data: null, name: null, error: "Το αρχείο δεν είναι PDF" };
  return { data, name: file.name.slice(0, 200), error: "" };
}

export const pdfResponse = (data: Uint8Array, name: string) =>
  new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="prototype.pdf"; filename*=UTF-8''${encodeURIComponent(name)}`,
    },
  });

type Parsed<T> = { data: T; error?: undefined } | { data?: undefined; error: string };

// Validated fields of an illness (create and edit).
export function parseIllness(b: Record<string, unknown> | null): Parsed<{ title: string; description: string | null; startDate: Date | null; endDate: Date | null }> {
  const title = clean(b?.title, 300);
  const startDate = day(b?.startDate);
  const endDate = day(b?.endDate);
  if (!title || startDate === undefined || endDate === undefined)
    return { error: "Συμπλήρωσε τίτλο ασθένειας (και σωστές ημερομηνίες)" };
  if (startDate && endDate && endDate < startDate) return { error: "Η ημερομηνία περάτωσης είναι πριν την εμφάνιση" };
  return { data: { title, description: clean(b?.description) || null, startDate, endDate } };
}

// Validated fields of a medication (create and edit).
export function parseMedication(b: Record<string, unknown> | null): Parsed<{ title: string; dosage: string | null; fromDate: Date | null; toDate: Date | null; notes: string | null }> {
  const title = clean(b?.title, 300);
  const fromDate = day(b?.fromDate);
  const toDate = day(b?.toDate);
  if (!title || fromDate === undefined || toDate === undefined) return { error: "Συμπλήρωσε τίτλο φαρμάκου (και σωστές ημερομηνίες)" };
  if (fromDate && toDate && toDate < fromDate) return { error: "Το «έως» είναι πριν το «από»" };
  return { data: { title, dosage: clean(b?.dosage, 300) || null, fromDate, toDate, notes: clean(b?.notes) || null } };
}
