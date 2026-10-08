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

// Rich free-text editor for the health history of one person. Saves sanitized HTML.
export default function HistoryEditor({ personId, initialHtml }: { personId: number; initialHtml: string }) {
  const box = useRef<HTMLDivElement>(null);
  // must be the same object on every render, otherwise React 19 rewrites the content (and the typing is lost)
  const initial = useRef({ __html: initialHtml });
  const [state, setState] = useState<"saved" | "dirty" | "saving" | "error">("saved");
  const [error, setError] = useState("");

  const exec = (cmd: string, arg?: string) => {
    box.current?.focus();
    document.execCommand(cmd, false, arg);
    setState("dirty");
  };

  const save = async () => {
    setState("saving");
    setError("");
    try {
      const res = await fetch("/api/person-history", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ person: personId, html: box.current?.innerHTML ?? "" }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? "Αποτυχία αποθήκευσης");
      if (box.current && typeof j.html === "string") box.current.innerHTML = j.html; // show what was actually saved
      setState("saved");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Αποτυχία αποθήκευσης");
      setState("error");
    }
  };

  return (
    <div className="card">
      <div className="row" role="toolbar" aria-label="Μορφοποίηση">
        {TOOLS.map((t) => (
          <button key={t.label} type="button" className="ghost" title={t.title}
            onMouseDown={(e) => e.preventDefault()} // keep the selection in the editor
            onClick={() => exec(t.cmd, t.arg)}>
            {t.label}
          </button>
        ))}
        <button type="button" onClick={save} disabled={state === "saving" || state === "saved"} style={{ marginLeft: "auto" }}>
          {state === "saving" ? "Αποθήκευση…" : "Αποθήκευση"}
        </button>
        <span className={state === "error" ? "bad" : "muted"}>
          {state === "saved" ? "Αποθηκευμένο" : state === "dirty" ? "Μη αποθηκευμένες αλλαγές" : state === "error" ? error : ""}
        </span>
      </div>
      <div
        ref={box}
        className="historyedit"
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label="Ιστορικό υγείας"
        onInput={() => setState("dirty")}
        dangerouslySetInnerHTML={initial.current}
      />
    </div>
  );
}
