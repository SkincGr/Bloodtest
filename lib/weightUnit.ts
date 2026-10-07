// Display units of the weight chart: readings are averaged per day / week / month / ...
export const UNITS: Record<string, string> = {
  day: "Μέρα",
  week: "Εβδομάδα",
  month: "Μήνας",
  quarter: "Τρίμηνο",
  half: "Εξάμηνο",
  year: "Έτος",
};

const pad = (n: number) => String(n).padStart(2, "0");

// First day (YYYY-MM-DD) of the bucket a date (YYYY-MM-DD) falls in.
export function bucketStart(day: string, unit: string): string {
  const y = Number(day.slice(0, 4));
  const m = Number(day.slice(5, 7));
  if (unit === "year") return `${y}-01-01`;
  if (unit === "half") return `${y}-${m <= 6 ? "01" : "07"}-01`;
  if (unit === "quarter") return `${y}-${pad(Math.floor((m - 1) / 3) * 3 + 1)}-01`;
  if (unit === "month") return `${y}-${pad(m)}-01`;
  if (unit === "week") {
    const d = new Date(`${day}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); // back to Monday
    return d.toISOString().slice(0, 10);
  }
  return day;
}

// Average weight per bucket, sorted by date ascending. `rows` need not be sorted.
export function aggregate(rows: { date: string; weight: number }[], unit: string) {
  const sums = new Map<string, { sum: number; n: number }>();
  for (const r of rows) {
    const k = bucketStart(r.date, unit);
    const e = sums.get(k) ?? { sum: 0, n: 0 };
    e.sum += r.weight;
    e.n++;
    sums.set(k, e);
  }
  return [...sums]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, e]) => ({ date, value: Math.round((e.sum / e.n) * 100) / 100, out: false }));
}
