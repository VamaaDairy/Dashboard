"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatNumber } from "@/lib/format";

/*
 * Chart colours, from the Gaia logo, each checked with the data-viz palette
 * validator against the white surface:
 *  - BLUE / GREEN: the categorical pair (CVD dE 30, both >= 3:1 contrast).
 *  - SEQ: one-hue sequential ramp for the heatmap, ending on the logo navy.
 *  - ORDINAL_GREEN: ordered bands (light end clears 2:1).
 */
export const GAIA = {
  blue: "#3548a8",
  green: "#2f9e44",
  seq: ["#e9ecf8", "#c5cced", "#97a3dc", "#6676c6", "#3548a8", "#26307c"],
  ordinalGreen: ["#72bd81", "#48a65d", "#2f8c43", "#1d6b2f"],
  empty: "#f1f1ef",   // no data - neutral, never a ramp step
  grid: "#e7e6e0",
  axis: "#c3c2b7",
  muted: "#898781",
  ink: "#0b0b0b",
  ink2: "#52514e",
  orange: "#eb6834",
} as const;

/**
 * Three-part categorical order for stacks and splits, validated on the light
 * surface: green, blue, orange - every adjacent pair clears CVD dE 18+ and
 * normal-vision dE 32+. Keep this order: green next to orange is only dE 6
 * for protan readers.
 */
export const CAT3 = [GAIA.green, GAIA.blue, GAIA.orange] as const;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function shortDate(d: string) {
  const [y, m, day] = d.split("-").map(Number);
  return `${day} ${MONTHS[m - 1]} ${String(y).slice(2)}`;
}

/** Width of an element, kept current - charts draw in real pixels so text never stretches. */
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.floor(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/** Round axis ticks: 0 / 250 / 500 ... never 0 / 237 / 474. */
function niceTicks(min: number, max: number, count = 4): number[] {
  if (!(max > min)) return [min];
  const raw = (max - min) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((s) => s * mag).find((s) => s >= raw) ?? raw;
  const start = Math.floor(min / step) * step;
  const out: number[] = [];
  for (let v = start; v <= max + step * 0.5; v += step) out.push(Number(v.toFixed(10)));
  return out;
}

/* ------------------------------------------------------------------ */
/* Tooltip - values lead, labels follow; a short line key per series   */
/* ------------------------------------------------------------------ */

export interface TipRow { label: string; value: string; color?: string }

function Tooltip({ x, y, title, rows, bound }: { x: number; y: number; title: string; rows: TipRow[]; bound: number }) {
  const left = x > bound - 190 ? x - 180 : x + 14;
  return (
    <div
      className="pointer-events-none absolute z-10 min-w-40 rounded-lg border border-border bg-white px-3 py-2 shadow-md"
      style={{ left, top: Math.max(0, y - 10) }}
    >
      <div className="mb-1 text-[11px] text-muted-foreground">{title}</div>
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-2 text-[12px]">
          {r.color ? <span className="h-0.5 w-3 rounded-full" style={{ background: r.color }} /> : null}
          <span className="num font-semibold text-foreground">{r.value}</span>
          <span className="text-muted-foreground">{r.label}</span>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Calendar heatmap                                                    */
/* ------------------------------------------------------------------ */

export interface HeatDay { day: string; value: number | null; tip: TipRow[] }

/**
 * A GitHub-style calendar: one column per week, one cell per day, darker =
 * more. Days with nothing are the neutral grey, never the lightest blue, so
 * "no milk" and "a little milk" never look alike.
 */
export function CalendarHeatmap({
  from, to, days, unit, decimals = 0, emptyLabel = "no milk",
}: {
  from: string;
  to: string;
  days: HeatDay[];
  unit: string;
  decimals?: number;
  /** what a day with nothing is called in the legend and tooltip */
  emptyLabel?: string;
}) {
  const [hover, setHover] = useState<{ x: number; y: number; d: HeatDay } | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const CELL = 12, GAP = 3, STEP = CELL + GAP, TOP = 18, LEFT = 28;

  const { cells, weeks, months, scale } = useMemo(() => {
    const byDay = new Map(days.map((d) => [d.day, d]));
    const start = new Date(`${from}T00:00:00Z`);
    const end = new Date(`${to}T00:00:00Z`);
    const lead = (start.getUTCDay() + 6) % 7; // Monday = row 0
    const values = days.map((d) => d.value).filter((v): v is number => v !== null && v > 0);
    const lo = values.length ? Math.min(...values) : 0;
    const hi = values.length ? Math.max(...values) : 1;
    const steps = GAIA.seq.slice(1); // 5 steps; seq[0] is too close to the surface for data
    const level = (v: number) => (hi > lo ? Math.min(steps.length - 1, Math.floor(((v - lo) / (hi - lo)) * steps.length)) : steps.length - 1);

    const cells: { day: string; col: number; row: number; fill: string; d: HeatDay | undefined }[] = [];
    const months: { col: number; label: string }[] = [];
    for (let i = 0, t = start.getTime(); t <= end.getTime(); i++, t += 86400000) {
      const date = new Date(t);
      const iso = date.toISOString().slice(0, 10);
      const idx = i + lead;
      const col = Math.floor(idx / 7);
      if (date.getUTCDate() === 1 || i === 0) months.push({ col, label: MONTHS[date.getUTCMonth()] });
      const d = byDay.get(iso);
      const v = d?.value ?? null;
      cells.push({ day: iso, col, row: idx % 7, fill: v !== null && v > 0 ? steps[level(v)] : GAIA.empty, d });
    }
    const weeks = cells.length ? cells[cells.length - 1].col + 1 : 0;
    // legend values at each step boundary
    const scale = steps.map((c, i) => ({ color: c, from: lo + ((hi - lo) * i) / steps.length }));
    return { cells, weeks, months: months.filter((m, i, a) => i === 0 || m.col - a[i - 1].col >= 3), scale };
  }, [days, from, to]);

  const width = LEFT + weeks * STEP;
  const height = TOP + 7 * STEP;

  return (
    <div ref={wrap} className="relative">
      <div className="overflow-x-auto">
        <svg width={width} height={height} role="img" aria-label={`Daily ${unit} calendar`}>
          {months.map((m) => (
            <text key={`${m.col}-${m.label}`} x={LEFT + m.col * STEP} y={11} fontSize={10} fill={GAIA.muted}>{m.label}</text>
          ))}
          {["Mon", "", "Wed", "", "Fri", "", ""].map((l, i) =>
            l ? <text key={i} x={0} y={TOP + i * STEP + 10} fontSize={10} fill={GAIA.muted}>{l}</text> : null,
          )}
          {cells.map((c) => (
            <rect
              key={c.day}
              x={LEFT + c.col * STEP}
              y={TOP + c.row * STEP}
              width={CELL}
              height={CELL}
              rx={2.5}
              fill={c.fill}
              tabIndex={c.d ? 0 : -1}
              onPointerEnter={(e) => {
                const box = wrap.current!.getBoundingClientRect();
                const r = (e.target as SVGRectElement).getBoundingClientRect();
                setHover({ x: r.left - box.left, y: r.top - box.top + 16, d: c.d ?? { day: c.day, value: null, tip: [{ label: emptyLabel, value: "—" }] } });
              }}
              onPointerLeave={() => setHover(null)}
              className="cursor-default outline-none hover:stroke-[#0b0b0b] focus:stroke-[#0b0b0b]"
              strokeWidth={1}
            />
          ))}
        </svg>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
        <span className="mr-1 flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: GAIA.empty }} /> {emptyLabel}
        </span>
        <span>Less</span>
        {scale.map((s) => <span key={s.color} className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} title={`from ${formatNumber(s.from, decimals)} ${unit}`} />)}
        <span>More</span>
        <span className="num">({formatNumber(scale[0]?.from ?? 0, decimals)} – {formatNumber(Math.max(...days.map((d) => d.value ?? 0), 0), decimals)} {unit})</span>
      </div>
      {hover ? <Tooltip x={hover.x} y={hover.y} title={shortDate(hover.d.day)} rows={hover.d.tip} bound={wrap.current?.clientWidth ?? 800} /> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Trend - one series over time, with a crosshair                      */
/* ------------------------------------------------------------------ */

export interface TrendPoint { day: string; value: number | null }

/**
 * One measure over time: a 2px line with a 10% wash under it. A day with no
 * value breaks the line rather than inventing a slope across the gap. The
 * crosshair snaps to the nearest day and reads out its value.
 */
export function TrendChart({
  points, color, unit, decimals = 1, height = 200, zeroBased = true, extraTip, emptyLabel = "no milk",
}: {
  emptyLabel?: string;
  points: TrendPoint[];
  color: string;
  unit: string;
  decimals?: number;
  height?: number;
  zeroBased?: boolean;
  extraTip?: (day: string) => TipRow[];
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const PAD = { top: 10, right: 12, bottom: 22, left: 44 };
  const W = Math.max(0, width - PAD.left - PAD.right);
  const H = height - PAD.top - PAD.bottom;

  const vals = points.map((p) => p.value).filter((v): v is number => v !== null);
  const vmin = vals.length ? Math.min(...vals) : 0;
  const vmax = vals.length ? Math.max(...vals) : 1;
  const ticks = niceTicks(zeroBased ? 0 : vmin - (vmax - vmin) * 0.1, vmax === vmin ? vmax + 1 : vmax);
  const y0 = ticks[0], y1 = ticks[ticks.length - 1];
  const x = (i: number) => (points.length <= 1 ? W / 2 : (i / (points.length - 1)) * W);
  const y = (v: number) => H - ((v - y0) / (y1 - y0 || 1)) * H;

  // split into runs so gaps break the line
  const runs: { i: number; v: number }[][] = [];
  points.forEach((p, i) => {
    if (p.value === null) { runs.push([]); return; }
    if (!runs.length) runs.push([]);
    runs[runs.length - 1].push({ i, v: p.value });
  });
  const line = (run: { i: number; v: number }[]) => run.map((p, k) => `${k ? "L" : "M"}${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`).join("");

  // x labels: about one per 110px, on month starts when the range is long
  const every = Math.max(1, Math.ceil(points.length / Math.max(1, Math.floor(W / 110))));
  const xLabels = points.map((p, i) => ({ i, day: p.day })).filter((_, i) => i % every === 0);

  const h = hover !== null ? points[hover] : null;

  return (
    <div ref={ref} className="relative" style={{ height }}>
      {width > 0 ? (
        <svg width={width} height={height} role="img" aria-label={`Daily ${unit}`}
          onPointerMove={(e) => {
            const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
            const px = e.clientX - rect.left - PAD.left;
            const i = Math.round((px / (W || 1)) * (points.length - 1));
            setHover(i >= 0 && i < points.length ? i : null);
          }}
          onPointerLeave={() => setHover(null)}
        >
          <g transform={`translate(${PAD.left},${PAD.top})`}>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={0} x2={W} y1={y(t)} y2={y(t)} stroke={GAIA.grid} strokeWidth={1} />
                <text x={-8} y={y(t) + 3} fontSize={10} fill={GAIA.muted} textAnchor="end" className="num">{formatNumber(t, t % 1 ? 1 : 0)}</text>
              </g>
            ))}
            {runs.filter((r) => r.length).map((run, k) => (
              <g key={k}>
                <path d={`${line(run)}L${x(run[run.length - 1].i)},${H}L${x(run[0].i)},${H}Z`} fill={color} opacity={0.1} />
                <path d={line(run)} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                {run.length === 1 ? <circle cx={x(run[0].i)} cy={y(run[0].v)} r={3} fill={color} /> : null}
              </g>
            ))}
            {xLabels.map((l) => (
              <text key={l.i} x={x(l.i)} y={H + 16} fontSize={10} fill={GAIA.muted} textAnchor="middle">{shortDate(l.day)}</text>
            ))}
            <line x1={0} x2={W} y1={H} y2={H} stroke={GAIA.axis} strokeWidth={1} />
            {h ? (
              <g>
                <line x1={x(hover!)} x2={x(hover!)} y1={0} y2={H} stroke={GAIA.axis} strokeWidth={1} />
                {h.value !== null ? <circle cx={x(hover!)} cy={y(h.value)} r={4.5} fill={color} stroke="#fff" strokeWidth={2} /> : null}
              </g>
            ) : null}
          </g>
        </svg>
      ) : null}
      {h ? (
        <Tooltip
          x={PAD.left + x(hover!)}
          y={PAD.top + (h.value !== null ? y(h.value) : H / 2)}
          title={shortDate(h.day)}
          rows={[
            { label: unit, value: h.value === null ? emptyLabel : formatNumber(h.value, decimals), color },
            ...(extraTip ? extraTip(h.day) : []),
          ]}
          bound={width}
        />
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Columns - one bar per month                                         */
/* ------------------------------------------------------------------ */

export interface BarDatum { key: string; label: string; value: number; tip: TipRow[] }

/** Columns <= 24px wide with a 4px rounded top, from one baseline; the value sits on the hovered cap. */
export function ColumnChart({ data, color, unit, height = 200 }: { data: BarDatum[]; color: string; unit: string; height?: number }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const PAD = { top: 16, right: 8, bottom: 22, left: 48 };
  const W = Math.max(0, width - PAD.left - PAD.right);
  const H = height - PAD.top - PAD.bottom;
  const max = Math.max(0, ...data.map((d) => d.value));
  const ticks = niceTicks(0, max || 1);
  const top = ticks[ticks.length - 1];
  const band = data.length ? W / data.length : 0;
  const bw = Math.min(24, band * 0.6);
  const y = (v: number) => H - (v / (top || 1)) * H;
  const every = Math.max(1, Math.ceil(data.length / Math.max(1, Math.floor(W / 48))));

  return (
    <div ref={ref} className="relative" style={{ height }}>
      {width > 0 ? (
        <svg width={width} height={height} role="img" aria-label={`${unit} by month`}>
          <g transform={`translate(${PAD.left},${PAD.top})`}>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={0} x2={W} y1={y(t)} y2={y(t)} stroke={GAIA.grid} strokeWidth={1} />
                <text x={-8} y={y(t) + 3} fontSize={10} fill={GAIA.muted} textAnchor="end" className="num">{formatNumber(t, 0)}</text>
              </g>
            ))}
            {data.map((d, i) => {
              const cx = band * i + band / 2;
              const h = H - y(d.value);
              const r = Math.min(4, h);
              return (
                <g key={d.key} onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)}>
                  {/* hit target: the whole band, not just the painted bar */}
                  <rect x={band * i} y={0} width={band} height={H} fill="transparent" />
                  {h > 0 ? (
                    <path
                      d={`M${cx - bw / 2},${H}V${y(d.value) + r}Q${cx - bw / 2},${y(d.value)} ${cx - bw / 2 + r},${y(d.value)}H${cx + bw / 2 - r}Q${cx + bw / 2},${y(d.value)} ${cx + bw / 2},${y(d.value) + r}V${H}Z`}
                      fill={color}
                      opacity={hover === null || hover === i ? 1 : 0.55}
                    />
                  ) : null}
                  {hover === i ? (
                    <text x={cx} y={y(d.value) - 5} fontSize={10} fill={GAIA.ink} textAnchor="middle" fontWeight={600} className="num">
                      {formatNumber(d.value, 0)}
                    </text>
                  ) : null}
                  {i % every === 0 ? <text x={cx} y={H + 15} fontSize={10} fill={GAIA.muted} textAnchor="middle">{d.label}</text> : null}
                </g>
              );
            })}
            <line x1={0} x2={W} y1={H} y2={H} stroke={GAIA.axis} strokeWidth={1} />
          </g>
        </svg>
      ) : null}
      {hover !== null && data[hover] ? (
        <Tooltip
          x={PAD.left + band * hover + band / 2}
          y={PAD.top + y(data[hover].value)}
          title={data[hover].label}
          rows={data[hover].tip}
          bound={width}
        />
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Donut - part to whole, <= 6 ordered segments                        */
/* ------------------------------------------------------------------ */

export interface Slice { label: string; value: number; color: string; note?: string }

/** A donut with a 2px surface gap between segments and the total in the hole; the legend carries every value. */
export function Donut({ slices, centre, centreLabel }: { slices: Slice[]; centre: string; centreLabel: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const total = slices.reduce((s, x) => s + x.value, 0);
  const R = 70, r = 46, C = 80;
  // each segment starts where the ones before it end, from 12 o'clock
  const share = (s: Slice) => (total ? s.value / total : 0);
  const arcs = slices.map((s, i) => {
    const before = slices.slice(0, i).reduce((sum, x) => sum + share(x), 0);
    const start = -Math.PI / 2 + before * Math.PI * 2;
    return { ...s, start, end: start + share(s) * Math.PI * 2, share: share(s) };
  });
  const pt = (rad: number, a: number) => `${C + rad * Math.cos(a)},${C + rad * Math.sin(a)}`;

  return (
    <div className="flex flex-wrap items-center gap-6">
      <svg width={160} height={160} role="img" aria-label={centreLabel}>
        {arcs.map((a, i) => {
          if (a.share <= 0) return null;
          if (a.share >= 0.9999) {
            return <circle key={a.label} cx={C} cy={C} r={(R + r) / 2} fill="none" stroke={a.color} strokeWidth={R - r} />;
          }
          const large = a.end - a.start > Math.PI ? 1 : 0;
          return (
            <path
              key={a.label}
              d={`M${pt(R, a.start)}A${R},${R} 0 ${large} 1 ${pt(R, a.end)}L${pt(r, a.end)}A${r},${r} 0 ${large} 0 ${pt(r, a.start)}Z`}
              fill={a.color}
              stroke="#fff"
              strokeWidth={2}
              opacity={hover === null || hover === i ? 1 : 0.5}
              onPointerEnter={() => setHover(i)}
              onPointerLeave={() => setHover(null)}
            />
          );
        })}
        <text x={C} y={C - 2} textAnchor="middle" fontSize={16} fontWeight={700} fill={GAIA.ink}>{centre}</text>
        <text x={C} y={C + 14} textAnchor="middle" fontSize={10} fill={GAIA.muted}>{centreLabel}</text>
      </svg>
      <ul className="space-y-1.5 text-[12px]">
        {arcs.map((a, i) => (
          <li key={a.label} className={`flex items-center gap-2 ${hover !== null && hover !== i ? "opacity-50" : ""}`}
            onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)}>
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: a.color }} />
            <span className="w-24 text-muted-foreground">{a.label}</span>
            <span className="num w-12 text-right font-semibold text-foreground">{formatNumber(a.share * 100, 0)}%</span>
            {a.note ? <span className="num text-muted-foreground">{a.note}</span> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Split bar - two parts of a whole (a 2-slice pie reads worse)        */
/* ------------------------------------------------------------------ */

export function SplitBar({ parts, unit = "L" }: { parts: { label: string; value: number; color: string }[]; unit?: string }) {
  const total = parts.reduce((s, p) => s + p.value, 0);
  return (
    <div>
      <div className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full bg-[#f1f1ef]">
        {parts.map((p) => (total && p.value > 0 ? (
          <div key={p.label} style={{ width: `${(p.value / total) * 100}%`, background: p.color }} title={`${p.label}: ${formatNumber(p.value, 0)}`} />
        ) : null))}
      </div>
      <ul className="mt-3 space-y-1.5 text-[12px]">
        {parts.map((p) => (
          <li key={p.label} className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: p.color }} />
            <span className="w-20 text-muted-foreground">{p.label}</span>
            <span className="num w-12 text-right font-semibold text-foreground">{total ? formatNumber((p.value / total) * 100, 0) : 0}%</span>
            <span className="num text-muted-foreground">{formatNumber(p.value, 0)} {unit}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Matrix heatmap - rows (products, SKUs, tanks...) x days             */
/* ------------------------------------------------------------------ */

export interface MatrixRow { key: string; label: string; cells: Record<string, number | null> }

/**
 * One row per item, one column per day, darker = more, on one shared scale so
 * rows compare with each other. Empty cells are the neutral grey. Each row
 * ends with its total; every cell has a tooltip.
 */
export function MatrixHeatmap({
  rows, days, unit, decimals = 0, emptyLabel = "none", showTotal = true,
}: {
  rows: MatrixRow[];
  days: string[];
  unit: string;
  decimals?: number;
  emptyLabel?: string;
  /** a total column - off for levels (stock) where adding days up means nothing */
  showTotal?: boolean;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<{ x: number; y: number; r: MatrixRow; day: string } | null>(null);
  const LABEL = 230, TOTAL = showTotal ? 72 : 8, TOP = 20, ROW = 22, GAP = 2;
  const cellW = Math.max(14, Math.min(56, Math.floor((Math.max(0, width - LABEL - TOTAL) - days.length * GAP) / Math.max(1, days.length))));
  const values = rows.flatMap((r) => days.map((d) => r.cells[d])).filter((v): v is number => v !== null && v !== undefined && v > 0);
  const lo = values.length ? Math.min(...values) : 0;
  const hi = values.length ? Math.max(...values) : 1;
  const steps = GAIA.seq.slice(1);
  const fill = (v: number | null | undefined) => {
    if (v === null || v === undefined || v <= 0) return GAIA.empty;
    const i = hi > lo ? Math.min(steps.length - 1, Math.floor(((v - lo) / (hi - lo)) * steps.length)) : steps.length - 1;
    return steps[i];
  };
  const svgW = LABEL + days.length * (cellW + GAP) + TOTAL;
  const svgH = TOP + rows.length * (ROW + GAP);
  const every = Math.max(1, Math.ceil(36 / (cellW + GAP)));

  return (
    <div ref={ref} className="relative">
      <div className="overflow-x-auto">
        {width > 0 ? (
          <svg width={svgW} height={svgH} role="img" aria-label={`${unit} by day`}>
            {days.map((d, i) => (i % every === 0 ? (
              <text key={d} x={LABEL + i * (cellW + GAP) + cellW / 2} y={12} fontSize={10} fill={GAIA.muted} textAnchor="middle">
                {shortDate(d).replace(/ \d+$/, "")}
              </text>
            ) : null))}
            {showTotal ? <text x={svgW - 4} y={12} fontSize={10} fill={GAIA.muted} textAnchor="end">Total</text> : null}
            {rows.map((r, ri) => {
              const y = TOP + ri * (ROW + GAP);
              const total = days.reduce((t, d) => t + (r.cells[d] ?? 0), 0);
              return (
                <g key={r.key}>
                  <text x={0} y={y + ROW / 2 + 4} fontSize={11} fill={GAIA.ink2}>
                    {r.label.length > 36 ? `${r.label.slice(0, 35)}…` : r.label}
                  </text>
                  {days.map((d, i) => (
                    <rect
                      key={d}
                      x={LABEL + i * (cellW + GAP)}
                      y={y}
                      width={cellW}
                      height={ROW}
                      rx={2.5}
                      fill={fill(r.cells[d])}
                      onPointerEnter={(e) => {
                        const box = ref.current!.getBoundingClientRect();
                        const rc = (e.target as SVGRectElement).getBoundingClientRect();
                        setHover({ x: rc.left - box.left, y: rc.top - box.top + ROW, r, day: d });
                      }}
                      onPointerLeave={() => setHover(null)}
                      className="cursor-default hover:stroke-[#0b0b0b]"
                      strokeWidth={1}
                    />
                  ))}
                  {showTotal ? (
                    <text x={svgW - 4} y={y + ROW / 2 + 4} fontSize={11} fill={GAIA.ink} textAnchor="end" fontWeight={600} className="num">
                      {formatNumber(total, decimals)}
                    </text>
                  ) : null}
                </g>
              );
            })}
          </svg>
        ) : null}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
        <span className="mr-1 flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: GAIA.empty }} /> {emptyLabel}
        </span>
        <span>Less</span>
        {steps.map((c) => <span key={c} className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: c }} />)}
        <span>More</span>
        <span className="num">({formatNumber(lo, decimals)} – {formatNumber(hi, decimals)} {unit})</span>
      </div>
      {hover ? (
        <Tooltip
          x={hover.x}
          y={hover.y}
          title={`${hover.r.label} · ${shortDate(hover.day)}`}
          rows={hover.r.cells[hover.day] === null || hover.r.cells[hover.day] === undefined
            ? [{ label: "", value: emptyLabel }]
            : [{ label: unit, value: formatNumber(hover.r.cells[hover.day]!, decimals) }]}
          bound={width}
        />
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Bar list - part to whole for more than two parts                    */
/* ------------------------------------------------------------------ */

/**
 * Horizontal bars sorted largest first, one hue - for a split with more parts
 * than a donut reads well (overhead heads, transporters...). Each row carries
 * its value and share; the bar is a 6px track with a rounded end.
 */
export function BarList({
  items, color = GAIA.blue, format = (v: number) => formatNumber(v, 0),
}: {
  items: { label: string; value: number; note?: string }[];
  color?: string;
  format?: (v: number) => string;
}) {
  const sorted = [...items].filter((i) => i.value > 0).sort((a, b) => b.value - a.value);
  const total = sorted.reduce((t, i) => t + i.value, 0);
  const max = sorted[0]?.value ?? 1;
  return (
    <ul className="space-y-2.5">
      {sorted.map((i) => (
        <li key={i.label} title={`${i.label}: ${format(i.value)}`}>
          <div className="flex items-baseline justify-between gap-3 text-[12px]">
            <span className="truncate text-muted-foreground">{i.label}</span>
            <span className="flex shrink-0 items-baseline gap-2">
              <span className="num font-semibold text-foreground">{format(i.value)}</span>
              <span className="num w-10 text-right text-muted-foreground">{total ? formatNumber((i.value / total) * 100, 0) : 0}%</span>
            </span>
          </div>
          <div className="mt-1 h-1.5 w-full rounded-full bg-[#f1f1ef]">
            <div className="h-1.5 rounded-full" style={{ width: `${(i.value / max) * 100}%`, background: color }} />
          </div>
          {i.note ? <div className="mt-0.5 text-[11px] text-muted-foreground">{i.note}</div> : null}
        </li>
      ))}
      {sorted.length === 0 ? <li className="text-[12px] text-muted-foreground">Nothing in this period.</li> : null}
    </ul>
  );
}

/* ------------------------------------------------------------------ */
/* Stacked bars - one horizontal bar per item, parts of its total      */
/* ------------------------------------------------------------------ */

export interface StackSeries { label: string; color: string }
export interface StackRow { key: string; label: string; parts: number[]; total?: string; note?: string }

/**
 * Horizontal bars on one shared scale, each split into the same ordered parts
 * with a 2px surface gap between segments. The legend names every part; each
 * row ends with its total, and hovering a segment reads out its value.
 */
export function StackedBars({ rows, series, format = (v: number) => formatNumber(v, 0) }: {
  rows: StackRow[]; series: StackSeries[]; format?: (v: number) => string;
}) {
  const [hover, setHover] = useState<{ row: string; part: number } | null>(null);
  const max = Math.max(1, ...rows.map((r) => r.parts.reduce((t, v) => t + v, 0)));
  const hovered = hover ? rows.find((x) => x.key === hover.row) : undefined;
  const hoveredTotal = hovered ? hovered.parts.reduce((t, v) => t + v, 0) : 0;
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-4 text-[12px]">
        {series.map((s) => (
          <span key={s.label} className="flex items-center gap-1.5 text-muted-foreground">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />{s.label}
          </span>
        ))}
      </div>
      <ul className="space-y-2">
        {rows.map((r) => {
          const total = r.parts.reduce((t, v) => t + v, 0);
          return (
            <li key={r.key} className="grid grid-cols-[minmax(0,10rem)_1fr_auto] items-center gap-3">
              <span className="truncate text-[12px] text-muted-foreground" title={r.label}>{r.label}</span>
              <div className="flex h-4 gap-0.5" style={{ width: `${(total / max) * 100}%`, minWidth: 4 }}>
                {r.parts.map((v, i) => (v > 0 ? (
                  <div key={i}
                    className="h-full first:rounded-l-[3px] last:rounded-r-[4px]"
                    style={{ flexGrow: v, flexBasis: 0, background: series[i].color, opacity: hover && (hover.row !== r.key || hover.part !== i) ? 0.45 : 1 }}
                    onPointerEnter={() => setHover({ row: r.key, part: i })}
                    onPointerLeave={() => setHover(null)}
                  />
                ) : null))}
              </div>
              <span className="num text-right text-[12px] font-semibold text-foreground">
                {r.total ?? format(total)}
                {r.note ? <span className="ml-1.5 font-normal text-muted-foreground">{r.note}</span> : null}
              </span>
            </li>
          );
        })}
      </ul>
      <div className="mt-2 h-4 text-[12px] text-muted-foreground">
        {hovered && hover ? (
          <>
            <span className="font-semibold text-foreground">{hovered.label}</span> · {series[hover.part].label}:{" "}
            <span className="num font-semibold text-foreground">{format(hovered.parts[hover.part])}</span>{" "}
            ({formatNumber((hovered.parts[hover.part] / (hoveredTotal || 1)) * 100, 0)}% of {format(hoveredTotal)})
          </>
        ) : "Hover a segment for its value."}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Stacked columns - one column per day, parts of the day's total      */
/* ------------------------------------------------------------------ */

export function StackedColumns({ days, series, values, unit, height = 220 }: {
  days: string[]; series: StackSeries[]; values: Record<string, number[]>; unit: string; height?: number;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const PAD = { top: 12, right: 8, bottom: 22, left: 52 };
  const W = Math.max(0, width - PAD.left - PAD.right);
  const H = height - PAD.top - PAD.bottom;
  const totals = days.map((d) => (values[d] ?? []).reduce((t, v) => t + v, 0));
  const ticks = niceTicks(0, Math.max(1, ...totals));
  const top = ticks[ticks.length - 1];
  const band = days.length ? W / days.length : 0;
  const bw = Math.max(3, Math.min(22, band * 0.7));
  const y = (v: number) => H - (v / (top || 1)) * H;
  const every = Math.max(1, Math.ceil(days.length / Math.max(1, Math.floor(W / 70))));

  return (
    <div ref={ref} className="relative">
      <div className="mb-1 flex flex-wrap gap-4 text-[12px]">
        {series.map((s) => (
          <span key={s.label} className="flex items-center gap-1.5 text-muted-foreground">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />{s.label}
          </span>
        ))}
      </div>
      <div className="relative" style={{ height }}>
        {width > 0 ? (
          <svg width={width} height={height} role="img" aria-label={`${unit} by day, stacked`}>
            <g transform={`translate(${PAD.left},${PAD.top})`}>
              {ticks.map((t) => (
                <g key={t}>
                  <line x1={0} x2={W} y1={y(t)} y2={y(t)} stroke={GAIA.grid} />
                  <text x={-8} y={y(t) + 3} fontSize={10} fill={GAIA.muted} textAnchor="end" className="num">{formatNumber(t, 0)}</text>
                </g>
              ))}
              {days.map((d, i) => {
                const cx = band * i + band / 2;
                const parts = values[d] ?? [];
                let acc = 0;
                return (
                  <g key={d} onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)} opacity={hover === null || hover === i ? 1 : 0.55}>
                    <rect x={band * i} y={0} width={band} height={H} fill="transparent" />
                    {parts.map((v, k) => {
                      if (v <= 0) return null;
                      const y0 = y(acc), y1 = y(acc + v);
                      acc += v;
                      const isTop = parts.slice(k + 1).every((x) => x <= 0);
                      const h = Math.max(0, y0 - y1 - (k > 0 ? 2 : 0));   // 2px surface gap between segments
                      return <rect key={k} x={cx - bw / 2} y={y1} width={bw} height={h} rx={isTop ? Math.min(3, h / 2) : 0} fill={series[k].color} />;
                    })}
                    {i % every === 0 ? <text x={cx} y={H + 15} fontSize={10} fill={GAIA.muted} textAnchor="middle">{shortDate(d).replace(/ \d+$/, "")}</text> : null}
                  </g>
                );
              })}
              <line x1={0} x2={W} y1={H} y2={H} stroke={GAIA.axis} />
            </g>
          </svg>
        ) : null}
        {hover !== null ? (
          <Tooltip
            x={PAD.left + band * hover + band / 2}
            y={PAD.top + y(totals[hover])}
            title={shortDate(days[hover])}
            rows={[
              ...series.map((s, k) => ({ label: s.label, value: formatNumber((values[days[hover]] ?? [])[k] ?? 0, 0), color: s.color })),
              { label: `${unit} total`, value: formatNumber(totals[hover], 0) },
            ]}
            bound={width}
          />
        ) : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Diverging columns - in above the line, out below                    */
/* ------------------------------------------------------------------ */

export function DivergingColumns({ days, up, down, upLabel, downLabel, unit, height = 240 }: {
  days: string[]; up: Record<string, number>; down: Record<string, number>;
  upLabel: string; downLabel: string; unit: string; height?: number;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const PAD = { top: 10, right: 8, bottom: 22, left: 52 };
  const W = Math.max(0, width - PAD.left - PAD.right);
  const H = height - PAD.top - PAD.bottom;
  const max = Math.max(1, ...days.map((d) => Math.max(up[d] ?? 0, down[d] ?? 0)));
  const ticks = niceTicks(0, max, 2);
  const top = ticks[ticks.length - 1];
  const mid = H / 2;
  const sc = (v: number) => (v / (top || 1)) * (H / 2);
  const band = days.length ? W / days.length : 0;
  const bw = Math.max(3, Math.min(20, band * 0.65));
  const every = Math.max(1, Math.ceil(days.length / Math.max(1, Math.floor(W / 70))));
  const bar = (cx: number, h: number, upward: boolean) => {
    const r = Math.min(3, h);
    const l = cx - bw / 2, rr = cx + bw / 2;
    return upward
      ? `M${l},${mid}V${mid - h + r}Q${l},${mid - h} ${l + r},${mid - h}H${rr - r}Q${rr},${mid - h} ${rr},${mid - h + r}V${mid}Z`
      : `M${l},${mid}V${mid + h - r}Q${l},${mid + h} ${l + r},${mid + h}H${rr - r}Q${rr},${mid + h} ${rr},${mid + h - r}V${mid}Z`;
  };
  return (
    <div ref={ref} className="relative">
      <div className="mb-1 flex gap-4 text-[12px] text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: GAIA.blue }} />{upLabel} (above the line)</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: GAIA.orange }} />{downLabel} (below)</span>
      </div>
      <div className="relative" style={{ height }}>
        {width > 0 ? (
          <svg width={width} height={height} role="img" aria-label={`${upLabel} and ${downLabel} by day`}>
            <g transform={`translate(${PAD.left},${PAD.top})`}>
              {ticks.flatMap((t) => (t === 0 ? [0] : [t, -t])).map((t) => (
                <g key={t}>
                  <line x1={0} x2={W} y1={mid - sc(t)} y2={mid - sc(t)} stroke={GAIA.grid} />
                  <text x={-8} y={mid - sc(t) + 3} fontSize={10} fill={GAIA.muted} textAnchor="end" className="num">{formatNumber(Math.abs(t), 0)}</text>
                </g>
              ))}
              {days.map((d, i) => {
                const cx = band * i + band / 2;
                const u = sc(up[d] ?? 0), dn = sc(down[d] ?? 0);
                return (
                  <g key={d} onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)} opacity={hover === null || hover === i ? 1 : 0.55}>
                    <rect x={band * i} y={0} width={band} height={H} fill="transparent" />
                    {u > 0 ? <path d={bar(cx, u, true)} fill={GAIA.blue} /> : null}
                    {dn > 0 ? <path d={bar(cx, dn, false)} fill={GAIA.orange} /> : null}
                    {i % every === 0 ? <text x={cx} y={H + 15} fontSize={10} fill={GAIA.muted} textAnchor="middle">{shortDate(d).replace(/ \d+$/, "")}</text> : null}
                  </g>
                );
              })}
              <line x1={0} x2={W} y1={mid} y2={mid} stroke={GAIA.axis} />
            </g>
          </svg>
        ) : null}
        {hover !== null ? (
          <Tooltip x={PAD.left + band * hover + band / 2} y={PAD.top + mid} title={shortDate(days[hover])} bound={width}
            rows={[
              { label: `${unit} ${upLabel.toLowerCase()}`, value: formatNumber(up[days[hover]] ?? 0, 0), color: GAIA.blue },
              { label: `${unit} ${downLabel.toLowerCase()}`, value: formatNumber(down[days[hover]] ?? 0, 0), color: GAIA.orange },
            ]} />
        ) : null}
      </div>
    </div>
  );
}
