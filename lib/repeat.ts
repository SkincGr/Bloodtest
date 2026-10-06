// When should an exam be repeated? Simple reminder rules based on the latest measurements.
// They are reminders, not medical advice: change the intervals to what your doctor recommends.
import { evaluate, formatPct } from "./range";

export const INTERVAL_MONTHS = {
  normal: 12, // last value inside the limits
  recentOut: 6, // last value inside, but the one before it was outside (check that it stays normal)
  out: 3, // last value outside the limits
};
export const SOON_DAYS = 30; // "Σύντομα" when the due date is this close

const DAY = 24 * 60 * 60 * 1000;

export type Repeat = {
  status: "due" | "soon" | "ok" | "none";
  interval: number | null; // months
  dueDate: string | null; // YYYY-MM-DD
  overdueDays: number | null; // > 0 when late
  reason: string;
};

type Limits = { min: number | null; max: number | null; condition: string | null };

const short = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(2, 4)}`;

function addMonths(day: string, n: number) {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 10);
}

const hasLimits = (l: Limits) =>
  (l.condition === "Between" && l.min != null && l.max != null) ||
  (l.condition === "<" && l.max != null) ||
  (l.condition === ">" && l.min != null);

// `readings` newest first; `today` = YYYY-MM-DD.
export function repeatAdvice(readings: { date: string; value: number }[], limits: Limits, today: string): Repeat {
  if (!readings.length) return { status: "none", interval: null, dueDate: null, overdueDays: null, reason: "Καμία μέτρηση" };

  const [last, prev] = readings;
  const lastEval = evaluate(last.value, limits.min, limits.max, limits.condition);
  const prevOut = prev ? evaluate(prev.value, limits.min, limits.max, limits.condition).out : false;

  let interval: number;
  let reason: string;
  if (lastEval.out) {
    interval = INTERVAL_MONTHS.out;
    const dev = lastEval.pct != null ? ` (${formatPct(lastEval.pct)})` : "";
    reason = `Τελευταία τιμή ${last.value} εκτός ορίων${dev} στις ${short(last.date)} → κάθε ${interval} μήνες`;
  } else if (prevOut) {
    interval = INTERVAL_MONTHS.recentOut;
    reason = `Εντός ορίων, αλλά η προηγούμενη (${short(prev.date)}: ${prev.value}) ήταν εκτός → κάθε ${interval} μήνες`;
  } else {
    interval = INTERVAL_MONTHS.normal;
    reason = hasLimits(limits)
      ? `Εντός ορίων → κάθε ${interval} μήνες`
      : `Χωρίς όρια στη βάση → κάθε ${interval} μήνες`;
  }

  const dueDate = addMonths(last.date, interval);
  const daysToDue = Math.round((Date.parse(dueDate) - Date.parse(today)) / DAY);
  const status = daysToDue < 0 ? "due" : daysToDue <= SOON_DAYS ? "soon" : "ok";
  return { status, interval, dueDate, overdueDays: daysToDue < 0 ? -daysToDue : null, reason };
}
