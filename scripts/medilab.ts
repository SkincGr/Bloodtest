// Parse one or more PDFs and print what was found. Usage: npx tsx scripts/medilab.ts file.pdf [...]
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { readFileSync } from "fs";
import { parsePdf, type PdfPage } from "../lib/parser";
import { extractCodes } from "../lib/itemCode";
(async () => {
  const items = JSON.parse(readFileSync("data/BloodItems.json", "utf-8")).map((i: any) => ({ id: i.Item_AID, name: i.Item_Name.trim(), code: extractCodes(i.Item_Name.trim().replace(/\s*\n\s*/g, " / ")).join(", ") }));
  for (const f of process.argv.slice(2)) {
    const doc = await getDocument({ data: new Uint8Array(readFileSync(f)), verbosity: 0 }).promise;
    let text = ""; const pages: PdfPage[] = [];
    for (let i = 1; i <= doc.numPages; i++) { const pg = await doc.getPage(i); const its = (await pg.getTextContent()).items as any[]; text += its.map((t) => t.str + (t.hasEOL ? "\n" : " ")).join("") + "\n"; pages.push({ width: pg.view[2], items: its.map((t) => ({ s: t.str, x: t.transform[4], y: t.transform[5], w: t.width, h: t.height })) }); }
    const p = parsePdf(text, pages, items);
    console.log("==", f.split(/[\/]/).pop(), "| date", p.date, "| mrn", p.mrn, "| values", p.values.length);
    for (const v of p.values) console.log("  ", String(v.itemId).padStart(2), v.name.replace(/\n.*/s, "").padEnd(44), v.value);
    for (const m of p.missing) console.log("   MISSING", m.itemId, m.name.slice(0,30).padEnd(30), JSON.stringify({p:m.region.page, x:+m.region.x.toFixed(1), y:+m.region.y.toFixed(1), w:+m.region.w.toFixed(1), h:+m.region.h.toFixed(1)}), m.range);
    for (const u of p.unmatched) console.log("   ? ", u.label, "=", u.value, u.range ?? "");
  }
})();
