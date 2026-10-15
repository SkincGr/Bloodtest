"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

// [Create Analysis]: asks the server to read the Ιστορικό and the last blood measurements and write a health report.
export default function CreateAnalysisButton({ personId }: { personId: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const create = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/health-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ person: personId }),
      });
      const text = await res.text();
      let j: { id?: number; error?: string } = {};
      try {
        j = JSON.parse(text);
      } catch {
        /* not JSON (e.g. a platform timeout page) */
      }
      if (!res.ok || !j.id) {
        throw new Error(
          j.error ?? (res.status === 504 || res.status === 408 ? "Η ανάλυση άργησε πολύ (timeout). Δοκίμασε ξανά." : `Αποτυχία (${res.status})`),
        );
      }
      router.push(`/illnesses?person=${personId}&report=${j.id}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Αποτυχία");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button type="button" onClick={create} disabled={busy}
        title="Διαβάζει το Ιστορικό και τις 5 τελευταίες μετρήσεις κάθε εξέτασης αίματος και γράφει ένα Health Report">
        {busy ? "Δημιουργία…" : "Create Analysis"}
      </button>
      {busy && <span className="muted small">Μπορεί να πάρει έως και ένα λεπτό.</span>}
      {error && <span className="bad">{error}</span>}
    </>
  );
}
