// Dependency-free SVG line chart: one series, optional normal-range band, out-of-range points in red.
export type ChartPoint = { date: string; value: number; out: boolean }; // date = YYYY-MM-DD, sorted asc

const W = 720, H = 240, L = 52, R = 16, T = 18, B = 34;

const fmtDate = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(2, 4)}`;
const MONTHS = ["ΙΑΝ", "ΦΕΒ", "ΜΑΡ", "ΑΠΡ", "ΜΑΙ", "ΙΟΥΝ", "ΙΟΥΛ", "ΑΥΓ", "ΣΕΠ", "ΟΚΤ", "ΝΟΕ", "ΔΕΚ"];
const fmtAxis = (d: string) => `${MONTHS[Number(d.slice(5, 7)) - 1]} ${d.slice(2, 4)}`; // "ΙΑΝ 22"
const fmtNum = (n: number, span: number) =>
  Number(n.toFixed(span >= 20 ? 0 : span >= 2 ? 1 : 2)).toString();

export default function LineChart({
  points,
  min,
  max,
  condition,
}: {
  points: ChartPoint[];
  min: number | null;
  max: number | null;
  condition: string | null;
}) {
  if (points.length === 0) return null;

  // Normal range as [low, high]; open ends are null.
  let low: number | null = null, high: number | null = null;
  if (condition === "Between" && min != null && max != null) [low, high] = [min, max];
  else if (condition === "<" && max != null) high = max;
  else if (condition === ">" && min != null) low = min;

  const vals = points.map((p) => p.value);
  let lo = Math.min(...vals, ...(low != null ? [low] : []));
  let hi = Math.max(...vals, ...(high != null ? [high] : []));
  if (lo === hi) { lo -= 1; hi += 1; }
  const pad = (hi - lo) * 0.12;
  lo -= pad; hi += pad;
  const span = hi - lo;

  const times = points.map((p) => Date.parse(p.date));
  const t0 = times[0], t1 = times[times.length - 1];
  const x = (i: number) =>
    t1 === t0 ? (L + W - R) / 2 : L + ((times[i] - t0) / (t1 - t0)) * (W - L - R);
  const y = (v: number) => T + (1 - (v - lo) / span) * (H - T - B);

  const path = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const bandTop = y(Math.min(high ?? hi, hi));
  const bandBottom = y(Math.max(low ?? lo, lo));

  const yTicks = [0, 1, 2, 3, 4].map((k) => lo + (span * k) / 4);
  // Label as many dates as fit: skip a label when it would overlap the previous one (x is by real time).
  const MIN_GAP = 30;
  const xLabels: { p: ChartPoint; i: number }[] = [];
  points.forEach((p, i) => {
    if (!xLabels.length || x(i) - x(xLabels[xLabels.length - 1].i) >= MIN_GAP) xLabels.push({ p, i });
  });
  const lastIdx = points.length - 1;
  if (xLabels[xLabels.length - 1].i !== lastIdx) {
    while (xLabels.length > 1 && x(lastIdx) - x(xLabels[xLabels.length - 1].i) < MIN_GAP) xLabels.pop();
    xLabels.push({ p: points[lastIdx], i: lastIdx });
  }
  const showValues = points.length <= 20;

  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img">
      {(low != null || high != null) && (
        <rect className="band" x={L} width={W - L - R} y={bandTop} height={Math.max(0, bandBottom - bandTop)} />
      )}
      {yTicks.map((v, k) => (
        <g key={k}>
          <line className="grid" x1={L} x2={W - R} y1={y(v)} y2={y(v)} />
          <text className="tick" x={L - 6} y={y(v) + 4} textAnchor="end">{fmtNum(v, span)}</text>
        </g>
      ))}
      {xLabels.map(({ p, i }) => (
        <text key={p.date} className="tick x" x={x(i)} y={H - 12} textAnchor="middle">{fmtAxis(p.date)}</text>
      ))}
      <path className="line" d={path} />
      {points.map((p, i) => (
        <g key={p.date}>
          <circle className={p.out ? "pt out" : "pt"} cx={x(i)} cy={y(p.value)} r={points.length > 150 ? 1.5 : 4}>
            <title>{`${fmtDate(p.date)}: ${p.value}`}</title>
          </circle>
          {showValues && (
            <text className={p.out ? "val out" : "val"} x={x(i)} y={y(p.value) - 9} textAnchor="middle">{p.value}</text>
          )}
        </g>
      ))}
    </svg>
  );
}
