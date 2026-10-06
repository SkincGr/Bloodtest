// Min/Max semantics come from the Access "Codition" column:
// Between = min..max, "<" = must be below max, ">" = must be above min; other kinds have no check.
export type RangeResult = { out: boolean; pct: number | null };

export function evaluate(
  v: number,
  min: number | null,
  max: number | null,
  cond: string | null,
): RangeResult {
  let limit: number | null = null;
  if (cond === "Between" && min != null && max != null) {
    if (v < min) limit = min;
    else if (v > max) limit = max;
  } else if (cond === "<" && max != null && v >= max) limit = max;
  else if (cond === ">" && min != null && v <= min) limit = min;

  if (limit == null) return { out: false, pct: null };
  // Signed deviation from the violated limit, in % of that limit (null when the limit is 0).
  const pct = limit === 0 ? null : ((v - limit) / Math.abs(limit)) * 100;
  return { out: true, pct };
}

export function formatPct(pct: number | null): string {
  if (pct == null) return "";
  const r = Math.abs(pct) < 10 ? pct.toFixed(1) : Math.round(pct).toString();
  return `${pct > 0 ? "+" : ""}${r}%`;
}
