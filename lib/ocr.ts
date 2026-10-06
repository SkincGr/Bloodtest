// Browser-only: reads a number that the lab drew as a vector shape (so it is not in the PDF's text layer).
// The page region is rendered with pdf.js, trimmed to the ink, and recognised with tesseract.js (digits only).
import type { Box } from "./parser";
import { parseRange } from "./range";

let workerP: Promise<any> | null = null;

// One shared worker; the first call downloads the engine + English data (a few MB, cached by the browser).
function getWorker() {
  if (!workerP) {
    workerP = (async () => {
      const { createWorker, PSM } = await import("tesseract.js");
      const w = await createWorker("eng");
      await w.setParameters({ tessedit_char_whitelist: "0123456789.", tessedit_pageseg_mode: PSM.SINGLE_LINE });
      return w;
    })();
    workerP.catch(() => (workerP = null)); // allow a retry after a network failure
  }
  return workerP;
}

// OCR often drops the small decimal point ("4.2" -> "42"). Put it back where the value is closest to the
// printed reference range; a result that already contains a point is trusted as read.
export function placeDecimal(text: string, range?: string): number | null {
  const t = text.replace(/[^\d.]/g, "").replace(/^\.+|\.+$/g, "");
  if (!t) return null;
  if (t.includes(".")) {
    const v = parseFloat(t);
    return isFinite(v) ? v : null;
  }
  const r = parseRange(range);
  const ref = r ? (r.min != null && r.max != null ? (r.min + r.max) / 2 : (r.max ?? r.min)) : null;
  const plain = parseFloat(t);
  if (!ref || ref <= 0) return plain;
  const cands = [plain, parseFloat("0." + t)];
  for (let k = 1; k < t.length; k++) cands.push(parseFloat(`${t.slice(0, k)}.${t.slice(k)}`));
  const dist = (c: number) => Math.abs(Math.log(c / ref));
  return cands.filter((c) => c > 0 && isFinite(c)).sort((a, b) => dist(a) - dist(b))[0] ?? plain;
}

export type OcrResult = { value: number | null; raw: string; image: string };

// `doc` is a pdf.js document (see openPdf in lib/pdf.ts). Returns null when the region holds no ink (blank value).
export async function ocrRegion(doc: any, region: Box, range?: string): Promise<OcrResult | null> {
  const page = await doc.getPage(region.page + 1);
  const S = 8; // render scale: a 5pt digit becomes ~40px tall, which tesseract likes
  const [vx, , , vtop] = page.view;
  const vp = page.getViewport({
    scale: S,
    offsetX: -(region.x - vx) * S,
    offsetY: -(vtop - (region.y + region.h)) * S,
  });
  const w = Math.max(1, Math.ceil(region.w * S));
  const h = Math.max(1, Math.ceil(region.h * S));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);
  await page.render({ canvasContext: ctx, viewport: vp }).promise;

  // Black/white + bounding box of the ink.
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const ink = d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11 < 170;
      d[i] = d[i + 1] = d[i + 2] = ink ? 0 : 255;
      d[i + 3] = 255;
      if (ink) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return null;

  const pad = 50;
  const out = document.createElement("canvas");
  out.width = x1 - x0 + 1 + 2 * pad;
  out.height = y1 - y0 + 1 + 2 * pad;
  const octx = out.getContext("2d")!;
  octx.fillStyle = "#fff";
  octx.fillRect(0, 0, out.width, out.height);
  octx.putImageData(img, pad - x0, pad - y0, x0, y0, x1 - x0 + 1, y1 - y0 + 1);

  const worker = await getWorker();
  const { data } = await worker.recognize(out);
  const raw = String(data.text ?? "").trim();
  return { value: placeDecimal(raw, range), raw, image: out.toDataURL("image/png") };
}
