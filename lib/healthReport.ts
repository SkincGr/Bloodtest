import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "./db";
import { evaluate, formatPct } from "./range";
import { sanitizeHtml } from "./sanitizeHtml";

export const REPORT_MODEL = "claude-opus-5-5";
const LAST_MEASUREMENTS = 5; // per exam
const MAX_HISTORY_CHARS = 400_000; // plain text of the Ιστορικό that is sent to Claude

const greek = (d: Date) => d.toISOString().slice(0, 10).split("-").reverse().join("/");

// HTML of the Ιστορικό -> plain text for the prompt
const htmlToText = (html: string) =>
  html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h2|h3|li|ul|ol)>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const SYSTEM = `Είσαι βοηθός που συντάσσει ενημερωτικές αναφορές υγείας (Health Report) για τον ίδιο τον ασθενή, στα ελληνικά.
Σου δίνονται (1) το ιστορικό υγείας του ασθενή σε ελεύθερο κείμενο και (2) οι τελευταίες μετρήσεις αιματολογικών και βιοχημικών εξετάσεων, με τα όρια αναφοράς και σήμανση όταν μια τιμή είναι εκτός ορίων.

Γράψε μια καθαρή, οργανωμένη αναφορά με τις ενότητες:
1. Σύνοψη (2-4 προτάσεις)
2. Αποτελέσματα αίματος: ποιες τιμές είναι εκτός ορίων, πόσο, και ποια είναι η τάση τους στις διαθέσιμες μετρήσεις (βελτίωση, επιδείνωση, σταθερή). Ομαδοποίησε τις σχετικές εξετάσεις.
3. Συσχέτιση με το ιστορικό: πώς τα ευρήματα μπορεί να σχετίζονται με όσα αναφέρονται στο ιστορικό (ασθένειες, φάρμακα, εξετάσεις).
4. Σημεία προσοχής και προτάσεις για συζήτηση με τον γιατρό (εξετάσεις προς επανάληψη, θέματα προς διερεύνηση).
5. Σημείωση: η αναφορά είναι ενημερωτική και δεν αντικαθιστά την ιατρική γνώμη.

Κανόνες:
- Στηρίξου μόνο στα δεδομένα που σου δίνονται. Μην επινοείς τιμές, ημερομηνίες ή διαγνώσεις. Αν κάτι λείπει (π.χ. κενό ιστορικό ή καμία μέτρηση), πες το καθαρά.
- Μην βάζεις διάγνωση ούτε οδηγίες θεραπείας ή αλλαγής φαρμάκων. Πρότεινε συζήτηση με τον γιατρό.
- Βγάλε ΜΟΝΟ HTML, χωρίς markdown και χωρίς \`\`\`. Χρησιμοποίησε μόνο αυτές τις ετικέτες: <h2>, <h3>, <p>, <ul>, <ol>, <li>, <b>, <i>, <br>. Χωρίς ιδιότητες (attributes), πίνακες ή στυλ.
- Μην αναφέρεις και μη ζητάς ονόματα ή προσωπικά στοιχεία.`;

export type ReportResult = { html: string } | { error: string };

// Builds the prompt data for a person: the Ιστορικό text + the last measurements of every exam that has any.
async function buildInput(personId: number): Promise<{ history: string; blood: string; exams: number } | { error: string }> {
  const [hist, items] = await Promise.all([
    prisma.personHistory.findUnique({ where: { personId } }),
    prisma.bloodItem.findMany({
      orderBy: [{ groupId: "asc" }, { subgroupId: "asc" }, { id: "asc" }],
      include: {
        group: true,
        subgroup: true,
        tests: { where: { personId }, orderBy: { date: "desc" }, take: LAST_MEASUREMENTS },
      },
    }),
  ]);

  const history = hist ? htmlToText(hist.html) : "";
  if (history.length > MAX_HISTORY_CHARS)
    return {
      error: `Το Ιστορικό είναι πολύ μεγάλο για ανάλυση (${history.length.toLocaleString("el-GR")} από ${MAX_HISTORY_CHARS.toLocaleString("el-GR")} χαρακτήρες). Μείωσέ το και δοκίμασε ξανά.`,
    };

  const lines: string[] = [];
  let exams = 0;
  let lastGroup = "";
  for (const it of items) {
    if (!it.tests.length) continue;
    exams++;
    const g = [it.group?.name, it.subgroup?.name].filter(Boolean).join(" › ");
    if (g !== lastGroup) {
      lines.push(`\n## ${g || "Άλλα"}`);
      lastGroup = g;
    }
    const name = it.name.replace(/\s*\n\s*/g, " / ").trim();
    const range = it.valueRange ? ` (όρια: ${it.valueRange})` : "";
    const vals = it.tests
      .map((t) => {
        const r = evaluate(t.value, it.min, it.max, it.condition);
        return `${greek(t.date)}: ${t.value}${r.out ? ` [ΕΚΤΟΣ ΟΡΙΩΝ${r.pct != null ? " " + formatPct(r.pct) : ""}]` : ""}`;
      })
      .join(" | ");
    lines.push(`- ${name}${range}: ${vals}`);
  }

  if (!history && !exams) return { error: "Δεν υπάρχουν δεδομένα: το Ιστορικό είναι κενό και δεν υπάρχουν μετρήσεις αίματος για αυτό το πρόσωπο." };
  return { history, blood: lines.join("\n").trim(), exams };
}

// Reads the Ιστορικό and the last 5 blood measurements of each exam and asks Claude for a health report (sanitized HTML).
export async function generateHealthReport(personId: number): Promise<ReportResult> {
  const input = await buildInput(personId);
  if ("error" in input) return input;
  if (!process.env.ANTHROPIC_API_KEY) return { error: "Λείπει το ANTHROPIC_API_KEY (.env και Vercel → Environment Variables)." };

  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Athens" });
  const user = `Σημερινή ημερομηνία: ${today}

# Ιστορικό υγείας (ελεύθερο κείμενο)
${input.history || "(κενό)"}

# Τελευταίες ${LAST_MEASUREMENTS} μετρήσεις αίματος ανά εξέταση (πρώτη η πιο πρόσφατη)
${input.blood || "(καμία μέτρηση)"}`;

  const client = new Anthropic();
  try {
    const stream = client.beta.messages.stream({
      model: REPORT_MODEL,
      max_tokens: 12000,
      output_config: { effort: "low" }, // keeps the request within the serverless time limit
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SYSTEM,
      messages: [{ role: "user", content: user }],
    });
    const msg = await stream.finalMessage();
    if (msg.stop_reason === "refusal") return { error: "Το μοντέλο αρνήθηκε να παραγάγει την αναφορά (έλεγχοι ασφαλείας). Δοκίμασε ξανά." };
    let text = msg.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("\n");
    text = text.replace(/^\s*```(?:html)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
    const html = sanitizeHtml(text);
    if (!html.replace(/<[^>]*>|\s/g, "")) return { error: "Το μοντέλο δεν επέστρεψε κείμενο. Δοκίμασε ξανά." };
    if (msg.stop_reason === "max_tokens") return { html: html + "<p><i>(Η αναφορά κόπηκε επειδή έφτασε το μέγιστο μήκος.)</i></p>" };
    return { html };
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) return { error: "Μη έγκυρο ANTHROPIC_API_KEY." };
    if (e instanceof Anthropic.RateLimitError) return { error: "Το όριο χρήσης του API ξεπεράστηκε προσωρινά. Δοκίμασε ξανά σε λίγο." };
    if (e instanceof Anthropic.APIError) return { error: `Σφάλμα του Claude API (${e.status}): ${e.message}` };
    return { error: "Αποτυχία σύνδεσης με το Claude API." };
  }
}
