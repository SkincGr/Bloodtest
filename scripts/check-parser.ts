// Compares parser output against data already imported from Access (data/*.json).
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { readFileSync, readdirSync } from "fs";
import { parseText } from "../lib/parser";

const dir = "C:/Users/CSKIN/BloodTest/Pdfs/Completed";
const items = JSON.parse(readFileSync("data/BloodItems.json", "utf-8")).map((i: any) => ({
  id: i.Item_AID,
  name: i.Item_Name.trim(),
}));
const tests = JSON.parse(readFileSync("data/BloodTest.json", "utf-8"));

async function text(path: string) {
  const doc = await getDocument({ data: new Uint8Array(readFileSync(path)), verbosity: 0 }).promise;
  let out = "";
  for (let i = 1; i <= doc.numPages; i++) {
    const tc = await (await doc.getPage(i)).getTextContent();
    out += tc.items.map((t: any) => t.str + (t.hasEOL ? "\n" : " ")).join("") + "\n";
  }
  return out;
}

(async () => {
  for (const f of readdirSync(dir).filter((f) => /\.pdf$/i.test(f))) {
    const p = parseText(await text(`${dir}/${f}`), items);
    const known = tests.filter((t: any) => t.Date?.slice(0, 10) === p.date);
    let match = 0, diff: string[] = [];
    for (const v of p.values) {
      const k = known.find((t: any) => t.Item.trim() === v.name);
      if (k) k.Value === v.value ? match++ : diff.push(`${v.name}: pdf=${v.value} db=${k.Value}`);
    }
    const onlyDb = known.filter((k: any) => !p.values.some((v) => v.name === k.Item.trim())).length;
    console.log(`${f.slice(0, 24).padEnd(24)} mrn=${p.mrn} date=${p.date} parsed=${p.values.length} db=${known.length} match=${match} diff=${diff.length} onlyInDb=${onlyDb}`);
    diff.slice(0, 3).forEach((d) => console.log("   ≠", d));
  }
})();
