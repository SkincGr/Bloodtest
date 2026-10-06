import type { RangeResult } from "./range";

export type Reading = { date: string; value: number } & RangeResult;

export type Trend =
  | "back" // was out of range, now inside
  | "ok" // inside before and now
  | "new" // was inside, now out
  | "better" // out of range both times, closer to the range
  | "worse" // out of range both times, further from the range
  | "same";

// How far outside the range a reading is (0 when inside). Uses % when both readings have it, else absolute distance.
const far = (r: Reading, usePct: boolean) => (!r.out ? 0 : usePct ? Math.abs(r.pct!) : r.dist);

// Compares two readings in time order: did the patient get closer to or further from the normal range?
export function compare(prev: Reading, last: Reading): Trend {
  if (prev.out && !last.out) return "back";
  if (!prev.out && last.out) return "new";
  if (!prev.out && !last.out) return "ok";
  const usePct = prev.pct != null && last.pct != null;
  const a = far(prev, usePct);
  const b = far(last, usePct);
  // No real change: under 10% of the previous deviation, and under 2 percentage points when measured in %.
  const tolerance = Math.max(0.1 * a, usePct ? 2 : 0);
  if (Math.abs(b - a) <= tolerance) return "same";
  return b < a ? "better" : "worse";
}

export const TREND_LABEL: Record<Trend, { text: string; cls: "ok" | "bad" | "muted" }> = {
  back: { text: "✓ επανήλθε στα όρια", cls: "ok" },
  ok: { text: "✓ εντός ορίων", cls: "ok" },
  new: { text: "↗ νέα απόκλιση", cls: "bad" },
  better: { text: "↘ βελτιώνεται", cls: "ok" },
  worse: { text: "↗ χειροτερεύει", cls: "bad" },
  same: { text: "→ σταθερό", cls: "muted" },
};
