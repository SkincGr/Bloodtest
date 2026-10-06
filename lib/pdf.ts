// Browser-only helpers around pdf.js.
import type { PdfPage } from "./parser";

export async function openPdf(file: File) {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();
  return pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
}

// Plain text (reading order) plus the raw text items with positions, per page.
export async function extractPdf(file: File): Promise<{ text: string; pages: PdfPage[] }> {
  const doc = await openPdf(file);
  let text = "";
  const pages: PdfPage[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const tc = await page.getTextContent();
    const items = tc.items as any[];
    text += items.map((t) => t.str + (t.hasEOL ? "\n" : " ")).join("") + "\n";
    pages.push({
      width: page.view[2] - page.view[0],
      items: items.map((t) => ({ s: t.str, x: t.transform[4], y: t.transform[5], w: t.width, h: t.height })),
    });
  }
  return { text, pages };
}
