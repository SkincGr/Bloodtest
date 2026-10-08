import { prisma } from "./db";
import { sanitizeHtml } from "./sanitizeHtml";

export const MAX_PDF = 4 * 1024 * 1024; // stays below the ~4.5 MB request limit of Vercel functions

const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v.trim() : "");

export type ExamFields = {
  personId: number;
  date: Date;
  title: string;
  text: string | null;
  analysis: string | null;
  GroupGen_ID: number | null;
  pdf: { data: Uint8Array<ArrayBuffer>; name: string } | null; // a newly uploaded PDF
  removePdf: boolean;
};

// Validates the multipart form of a GeneralExam (create and edit). Returns the fields or an error message.
export async function parseExamForm(f: FormData): Promise<{ fields: ExamFields; error?: undefined } | { fields?: undefined; error: string }> {
  const personId = Number(str(f.get("person")));
  const date = str(f.get("date"));
  const title = str(f.get("title"));
  if (!Number.isInteger(personId) || !/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date)) || !title || title.length > 300)
    return { error: "Συμπλήρωσε πρόσωπο, ημερομηνία και τίτλο" };
  if (!(await prisma.person.findUnique({ where: { id: personId } }))) return { error: "Άγνωστο πρόσωπο" };

  let pdf: ExamFields["pdf"] = null;
  const file = f.get("prototype");
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_PDF) return { error: "Το PDF είναι πάνω από 4 MB" };
    const data = new Uint8Array(await file.arrayBuffer());
    if (new TextDecoder().decode(data.subarray(0, 5)) !== "%PDF-") return { error: "Το αρχείο δεν είναι PDF" };
    pdf = { data, name: file.name.slice(0, 200) };
  }

  const GroupGen_ID = Number(str(f.get("group"))) || null;
  if (GroupGen_ID && !(await prisma.groupGen.findUnique({ where: { GroupGen_ID } }))) return { error: "Άγνωστη ομάδα" };

  // text and analysis are HTML (sanitized); an editor with no visible content counts as empty
  const html = (v: FormDataEntryValue | null) => {
    const clean = sanitizeHtml(str(v));
    return clean.replace(/<[^>]*>|&nbsp;|\s/g, "") ? clean : null;
  };

  return {
    fields: {
      personId,
      date: new Date(date),
      title,
      text: html(f.get("text")),
      analysis: html(f.get("analysis")),
      GroupGen_ID,
      pdf,
      removePdf: f.get("removePdf") === "on",
    },
  };
}
