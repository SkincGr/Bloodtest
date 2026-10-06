// Compares parser output against data already imported from Access (data/*.json).
// Usage: npx tsx scripts/check-parser.ts [-v]   (-v lists rows that matched no item)
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { readFileSync, readdirSync } from "fs";
import { parsePdf, type PdfPage } from "../lib/parser";
import { extractCodes } from "../lib/itemCode";

const dir = "C:/Users/CSKIN/BloodTest/Pdfs/Completed";
const items = JSON.parse(readFileSync("data/BloodItems.json", "utf-8")).map((i: any) => ({
  id: i.Item_AID,
  name: i.Item_Name.trim(),
  code: extractCodes(i.Item_Name.trim().replace(/\s*\n\s*/g, " / ")).join(", "),
}));
const tests = JSON.parse(readFileSync("data/BloodTest.json", "utf-8"));

async function read(path: string) {
  const doc = await getDocument({ data: new Uint8Array(readFileSync(path)), verbosity: 0 }).promise;
  let text = "";
  const pages: PdfPage[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const its = (await page.getTextContent()).items as any[];
    text += its.map((t) => t.str + (t.hasEOL ? "\n" : " ")).join("") + "\n";
    pages.push({
      width: page.view[2] - page.view[0],
      items: its.map((t) => ({ s: t.str, x: t.transform[4], y: t.transform[5] })),
    });
  }
  return { text, pages };
}

(async () => {
  for (const f of readdirSync(dir).filter((f) => /\.pdf$/i.test(f))) {
    const { text, pages } = await read(`${dir}/${f}`);
    const p = parsePdf(text, pages, items);
    const known = tests.filter((t: any) => t.Date?.slice(0, 10) === p.date);
    let match = 0;
    const diff: string[] = [];
    for (const v of p.values) {
      const k = known.find((t: any) => t.Item.trim() === v.name);
      if (k) k.Value === v.value ? match++ : diff.push(`${v.name}: pdf=${v.value} db=${k.Value}`);
    }
    const onlyDb = known.filter((k: any) => !p.values.some((v) => v.name === k.Item.trim())).length;
    console.log(
      `${f.slice(0, 24).padEnd(24)} date=${p.date} parsed=${p.values.length} db=${known.length} match=${match} diff=${diff.length} onlyInDb=${onlyDb} unmatched=${p.unmatched.length}`,
    );
    known.filter((k: any) => !p.values.some((v) => v.name === k.Item.trim())).forEach((k: any) => console.log("   onlyInDb:", k.Item, k.Value));
    diff.slice(0, 5).forEach((d) => console.log("   ≠", d));
    if (process.argv[2] === "-v") p.unmatched.forEach((u) => console.log("   ?", u.label, u.value));
  }
})();
