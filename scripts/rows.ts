import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { readFileSync } from "fs";
import { decodeText } from "../lib/parser";
(async () => {
  const doc = await getDocument({ data: new Uint8Array(readFileSync(process.argv[2])), verbosity: 0 }).promise;
  for (let p = 1; p <= doc.numPages; p++) {
    const tc = await (await doc.getPage(p)).getTextContent();
    const its = tc.items.filter((t: any) => t.str.trim()).map((t: any) => ({ s: decodeText(t.str), x: t.transform[4], y: t.transform[5] }));
    its.sort((a: any, b: any) => b.y - a.y || a.x - b.x);
    const rows: any[][] = [];
    for (const it of its) {
      const r = rows[rows.length - 1];
      if (r && Math.abs(r[0].y - it.y) < 3) r.push(it); else rows.push([it]);
    }
    console.log(`--- page ${p}`);
    for (const r of rows) { r.sort((a, b) => a.x - b.x); console.log(r.map((i) => `${i.s}@${Math.round(i.x)}`).join(" | ")); }
  }
})();
