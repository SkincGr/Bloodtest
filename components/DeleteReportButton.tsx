"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function DeleteReportButton({ id, personId, title }: { id: number; personId: number; title: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button type="button" className="ghost" disabled={busy} title="Διαγραφή αναφοράς"
      onClick={async () => {
        if (!confirm(`Διαγραφή της αναφοράς «${title}»;`)) return;
        setBusy(true);
        const res = await fetch(`/api/health-report/${id}`, { method: "DELETE" });
        setBusy(false);
        if (!res.ok) return alert("Αποτυχία διαγραφής");
        router.push(`/illnesses?person=${personId}`);
        router.refresh();
      }}>
      🗑 Διαγραφή
    </button>
  );
}
