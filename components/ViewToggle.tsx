"use client";
import { useRouter } from "next/navigation";

// "Με γράφημα" / "Με πίνακα" on the history page; reloads `path` with ?view=… and keeps the other params.
export default function ViewToggle({
  path,
  params,
  view,
}: {
  path: string;
  params: Record<string, string>;
  view: "chart" | "table";
}) {
  const router = useRouter();
  const go = (v: "chart" | "table") => {
    const q = new URLSearchParams(params);
    if (v === "table") q.set("view", "table");
    else q.delete("view");
    router.push(`${path}?${q}`);
  };
  return (
    <div className="viewtoggle" role="radiogroup" aria-label="Μορφή αποτελεσμάτων">
      <label>
        <input type="radio" name="view" checked={view === "chart"} onChange={() => go("chart")} /> Με γράφημα
      </label>
      <label>
        <input type="radio" name="view" checked={view === "table"} onChange={() => go("table")} /> Με πίνακα
      </label>
    </div>
  );
}
