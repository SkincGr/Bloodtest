// Shared by the pages that filter results by a period (trends, out-of-range).
export const PERIODS: Record<string, string> = {
  all: "Όλες οι μετρήσεις",
  "1m": "Τελευταίος μήνας",
  "3m": "Τελευταίοι 3 μήνες",
  "6m": "Τελευταίοι 6 μήνες",
  "1y": "Τελευταίο έτος",
  "2y": "Τελευταία 2 έτη",
  "5y": "Τελευταία 5 έτη",
  custom: "Προσαρμοσμένη…",
};

export const isDay = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);

// Reads ?period=&from=&to= from a page's search params.
export function readPeriod(sp: { period?: string; from?: string; to?: string }) {
  return {
    period: sp.period && sp.period in PERIODS ? sp.period : "all",
    from: isDay(sp.from) ? sp.from! : "",
    to: isDay(sp.to) ? sp.to! : "",
  };
}

// Prisma date filter for the chosen period (relative periods count back from today).
export function dateFilter(period: string, from?: string, to?: string): { gte?: Date; lte?: Date } {
  if (period === "custom")
    return { ...(isDay(from) && { gte: new Date(from!) }), ...(isDay(to) && { lte: new Date(to!) }) };
  const m = period.match(/^(\d+)(m|y)$/);
  if (!m) return {};
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCMonth(d.getUTCMonth() - Number(m[1]) * (m[2] === "y" ? 12 : 1));
  return { gte: d };
}
