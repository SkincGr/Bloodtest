"use client";
import { useEffect, useRef, useState } from "react";
import { openPdf } from "@/lib/pdf";
import type { Box } from "@/lib/parser";

export type Mark = {
  id: string;
  boxes: Box[];
  kind: "ok" | "off" | "unmatched" | "missing"; // matched+selected, matched but unchecked, not matched, value drawn as a shape
  title: string;
};

type PageImg = { src: string; w: number; h: number; vp: any };

// Renders every page to an image and overlays coloured rectangles for the marks.
export default function PdfViewer({
  file,
  marks,
  active,
  onSelect,
}: {
  file: File;
  marks: Mark[];
  active?: { id: string; n: number };
  onSelect?: (id: string) => void;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState<PageImg[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setPages([]);
    setError("");
    (async () => {
      try {
        const doc = await openPdf(file);
        const width = wrap.current?.clientWidth || 600;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const out: PageImg[] = [];
        for (let i = 1; i <= doc.numPages; i++) {
          const page = await doc.getPage(i);
          const scale = width / page.getViewport({ scale: 1 }).width;
          const vp = page.getViewport({ scale });
          const canvas = document.createElement("canvas");
          canvas.width = Math.floor(vp.width * dpr);
          canvas.height = Math.floor(vp.height * dpr);
          await page.render({
            canvasContext: canvas.getContext("2d")!,
            viewport: page.getViewport({ scale: scale * dpr }),
          }).promise;
          out.push({ src: canvas.toDataURL("image/jpeg", 0.9), w: vp.width, h: vp.height, vp });
          if (cancelled) return;
          setPages([...out]);
        }
      } catch (e) {
        if (!cancelled) setError(String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [file]);

  // Scroll the pane to the active mark.
  useEffect(() => {
    if (!active) return;
    wrap.current
      ?.querySelector(`[data-mark="${active.id}"]`)
      ?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [active]);

  return (
    <div ref={wrap} className="pdfpages">
      {error && <p className="bad">{error}</p>}
      {!pages.length && !error && <p className="muted" style={{ padding: 16 }}>Φόρτωση PDF…</p>}
      {pages.map((p, pi) => (
        <div className="pdfpage" key={pi} style={{ aspectRatio: `${p.w} / ${p.h}` }}>
          <img src={p.src} alt={`Σελίδα ${pi + 1}`} />
          {marks.flatMap((m) =>
            m.boxes
              .filter((b) => b.page === pi)
              .map((b, bi) => {
                const [x1, y1, x2, y2] = p.vp.convertToViewportRectangle([b.x, b.y, b.x + b.w, b.y + b.h]);
                return (
                  <div
                    key={`${m.id}-${bi}`}
                    data-mark={bi === 0 ? m.id : undefined}
                    className={`mk ${m.kind}${active?.id === m.id ? " focus" : ""}`}
                    title={m.title}
                    onClick={() => onSelect?.(m.id)}
                    style={{
                      left: `${(Math.min(x1, x2) / p.w) * 100}%`,
                      top: `${(Math.min(y1, y2) / p.h) * 100}%`,
                      width: `${(Math.abs(x2 - x1) / p.w) * 100}%`,
                      height: `${(Math.abs(y2 - y1) / p.h) * 100}%`,
                    }}
                  />
                );
              }),
          )}
        </div>
      ))}
    </div>
  );
}
