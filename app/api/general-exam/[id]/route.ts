import { prisma } from "@/lib/db";

// GET /api/general-exam/:id -> the stored PDF (prototype) of a GeneralExam.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const exam = await prisma.generalExam.findUnique({
    where: { id: Number((await params).id) || 0 },
    select: { prototype: true, prototypeName: true },
  });
  if (!exam?.prototype) return new Response("Δεν υπάρχει PDF", { status: 404 });
  const name = exam.prototypeName ?? "prototype.pdf";
  return new Response(new Uint8Array(exam.prototype), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="prototype.pdf"; filename*=UTF-8''${encodeURIComponent(name)}`,
    },
  });
}
