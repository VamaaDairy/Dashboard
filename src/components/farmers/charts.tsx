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
} as const;

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
  from, to, days, unit, decimals = 0,
}: {
  from: string;
  to: string;
  days: HeatDay[];
  unit: string;
  decimals?: number;
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
                setHover({ x: r.left - box.left, y: r.top - box.top + 16, d: c.d ?? { day: c.day, value: null, tip: [{ label: "no milk", value: "—" }] } });
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
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: GAIA.empty }} /> no milk
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
  points, color, unit, decimals = 1, height = 200, zeroBased = true, extraTip,
}: {
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
            { label: unit, value: h.value === null ? "no milk" : formatNumber(h.value, decimals), color },
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

export function SplitBar({ parts }: { parts: { label: string; value: number; color: string }[] }) {
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
            <span className="num text-muted-foreground">{formatNumber(p.value, 0)} L</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
