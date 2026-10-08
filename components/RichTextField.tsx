"use client";
import { useRef, useState } from "react";

const TOOLS: { label: string; title: string; cmd: string; arg?: string }[] = [
  { label: "B", title: "Έντονα", cmd: "bold" },
  { label: "I", title: "Πλάγια", cmd: "italic" },
  { label: "U", title: "Υπογράμμιση", cmd: "underline" },
  { label: "Τίτλος", title: "Τίτλος", cmd: "formatBlock", arg: "h3" },
  { label: "Κείμενο", title: "Κανονική παράγραφος", cmd: "formatBlock", arg: "p" },
  { label: "• Λίστα", title: "Λίστα", cmd: "insertUnorderedList" },
  { label: "1. Λίστα", title: "Αριθμημένη λίστα", cmd: "insertOrderedList" },
];

// HTML-only text field for forms: a small rich-text editor whose HTML is submitted under `name`
// (the server sanitizes it). Works inside a <form> that is read with new FormData(form).
export default function RichTextField({
  name,
  label,
  initialHtml = "",
  minHeight = 140,
}: {
  name: string;
  label: string;
  initialHtml?: string;
  minHeight?: number;
}) {
  const box = useRef<HTMLDivElement>(null);
  // must be the same object on every render, otherwise React 19 rewrites the content (and the typing is lost)
  const initial = useRef({ __html: initialHtml });
  const [html, setHtml] = useState(initialHtml);

  const exec = (cmd: string, arg?: string) => {
    box.current?.focus();
    document.execCommand(cmd, false, arg);
    setHtml(box.current?.innerHTML ?? "");
  };

  return (
    <div style={{ gridColumn: "1 / -1" }}>
      <div className="muted" style={{ fontSize: 13, marginBottom: 3 }}>{label}</div>
      <div className="row" role="toolbar" aria-label={`Μορφοποίηση: ${label}`} style={{ marginBottom: 4, gap: 6 }}>
        {TOOLS.map((t) => (
          <button key={t.label} type="button" className="ghost" title={t.title}
            onMouseDown={(e) => e.preventDefault()} // keep the selection in the editor
            onClick={() => exec(t.cmd, t.arg)}>
            {t.label}
          </button>
        ))}
      </div>
      <div
        ref={box}
        className="historyedit"
        style={{ minHeight }}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label={label}
        onInput={() => setHtml(box.current?.innerHTML ?? "")}
        dangerouslySetInnerHTML={initial.current}
      />
      <input type="hidden" name={name} value={html} />
    </div>
  );
}
