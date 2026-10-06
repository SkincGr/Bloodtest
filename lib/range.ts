// Min/Max semantics come from the Access "Codition" column:
// Between = min..max, "<" = must be below max, ">" = must be above min; other kinds have no check.
// pct = signed deviation in % of the violated limit; dist = absolute distance beyond that limit.
export type RangeResult = { out: boolean; pct: number | null; dist: number };

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

  if (limit == null) return { out: false, pct: null, dist: 0 };
  // Signed deviation from the violated limit, in % of that limit (null when the limit is 0).
  const pct = limit === 0 ? null : ((v - limit) / Math.abs(limit)) * 100;
  return { out: true, pct, dist: Math.abs(v - limit) };
}

export function formatPct(pct: number | null): string {
  if (pct == null) return "";
  const r = Math.abs(pct) < 10 ? pct.toFixed(1) : Math.round(pct).toString();
  return `${pct > 0 ? "+" : ""}${r}%`;
}

// Turns a printed reference range into the BloodItem Min/Max/Codition fields.
// "0.12-0.35" -> Between 0.12..0.35, "<0.5" -> "<" 0.5, ">3" -> ">" 3.
export function parseRange(
  s: string | null | undefined,
): { condition: string; min: number | null; max: number | null } | null {
  const t = (s ?? "").replace(/\s+/g, "").replace(/,/g, ".");
  const n = (x: string) => parseFloat(x);
  let m = t.match(/^(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)$/);
  if (m) return { condition: "Between", min: n(m[1]), max: n(m[2]) };
  m = t.match(/^<=?(\d+(?:\.\d+)?)$/);
  if (m) return { condition: "<", min: null, max: n(m[1]) };
  m = t.match(/^>=?(\d+(?:\.\d+)?)$/);
  if (m) return { condition: ">", min: n(m[1]), max: null };
  return null;
}
