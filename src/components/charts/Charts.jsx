import { useState } from 'react';
import useElementWidth from '@/hooks/useElementWidth';
import { formatNumber } from '@/utils/format';

/**
 * Hand-rolled inline SVG charts — no charting library.
 *
 * Every chart draws into a viewBox that matches its measured pixel width, so
 * one SVG unit is one CSS pixel. Nothing is scaled: a chart asked for 260px is
 * 260px, and an 11px label is 11px. (The earlier fixed 680-unit viewBox scaled
 * the whole drawing ~1.7× inside a wide card, which is what made everything
 * look oversized.)
 *
 * Mark specs: thin marks, a 2px surface gap between stacked segments, 4px
 * rounded corners on the data end only, 2px lines, a marker only on the hovered
 * point, and a recessive grid. One y-axis, never two.
 */

const seriesColor = (i) => `var(--c-series-${i % 5})`;

/** Axis ticks: at most this many, so a 28-day series does not print 28 labels. */
const maxTicks = (width) => Math.max(4, Math.floor(width / 90));

/* ---------- Legend ---------- */

export function Legend({ items, className = '' }) {
  return (
    <ul className={`legend ${className}`.trim()} style={{ listStyle: 'none', margin: 0, padding: 0 }}>
      {items.map((it) => (
        <li key={it.label} className="legend__item">
          <span className="legend__swatch" style={{ background: it.color }} />
          {it.label}
          {it.value != null && <span className="mono strong" style={{ marginLeft: 4 }}>{it.value}</span>}
        </li>
      ))}
    </ul>
  );
}

/* ---------- Stacked / grouped bar ---------- */

export function BarChart({
  data, series, xKey = 'period', height = 260,
  xLabel, yLabel, formatValue = formatNumber, legend = true,
}) {
  const [ref, W] = useElementWidth();
  const [hover, setHover] = useState(null);

  const H = height;
  const PAD = { top: 8, right: 6, bottom: xLabel ? 34 : 20, left: yLabel ? 46 : 34 };
  const plotW = Math.max(W - PAD.left - PAD.right, 10);
  const plotH = Math.max(H - PAD.top - PAD.bottom, 10);

  const totals = data.map((row) => series.reduce((s, x) => s + (row[x.key] ?? 0), 0));
  const max = Math.max(1, ...totals);
  const step = 10 ** Math.floor(Math.log10(max));
  const niceMax = Math.ceil(max / step) * step || 10;

  const slot = plotW / Math.max(data.length, 1);
  const barW = Math.min(46, slot * 0.62);
  const y = (v) => PAD.top + plotH - (v / niceMax) * plotH;

  const labelEvery = Math.max(1, Math.ceil(data.length / maxTicks(plotW)));

  return (
    <div className="chart-frame" ref={ref}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label={`${yLabel ?? 'Value'} by ${xLabel ?? 'period'}`}>
        {[0, 1, 2, 3].map((i) => {
          const v = (niceMax / 3) * i;
          return (
            <g key={i}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} className="chart__grid" />
              <text x={PAD.left - 6} y={y(v) + 3.5} className="chart__axis" textAnchor="end">{formatNumber(Math.round(v))}</text>
            </g>
          );
        })}

        {data.map((row, i) => {
          const x = PAD.left + slot * i + (slot - barW) / 2;
          let cursor = 0;
          return (
            <g key={row[xKey]} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={PAD.left + slot * i} y={PAD.top} width={slot} height={plotH} fill="transparent" />
              {series.map((s, si) => {
                const v = row[s.key] ?? 0;
                if (!v) return null;
                const segH = (v / niceMax) * plotH;
                const top = PAD.top + plotH - cursor - segH;
                cursor += segH;
                const isTop = series.slice(si + 1).every((rest) => !(row[rest.key] ?? 0));
                return (
                  <rect
                    key={s.key}
                    x={x} y={top} width={barW}
                    height={Math.max(segH - 2, 1)}
                    rx={isTop ? 4 : 0}
                    fill={s.color ?? seriesColor(si)}
                    opacity={hover == null || hover === i ? 1 : 0.42}
                    style={{ transition: 'opacity 120ms var(--ease)' }}
                  >
                    <title>{`${row[xKey]} · ${s.name}: ${formatValue(v)}`}</title>
                  </rect>
                );
              })}
              {i % labelEvery === 0 && (
                <text x={PAD.left + slot * i + slot / 2} y={H - (xLabel ? 20 : 6)} className="chart__axis" textAnchor="middle">
                  {row[xKey]}
                </text>
              )}
            </g>
          );
        })}

        <line x1={PAD.left} x2={W - PAD.right} y1={PAD.top + plotH} y2={PAD.top + plotH} className="chart__baseline" />

        {xLabel && <text x={PAD.left + plotW / 2} y={H - 4} className="chart__axis-title" textAnchor="middle">{xLabel}</text>}
        {yLabel && (
          <text transform={`rotate(-90 11 ${PAD.top + plotH / 2})`} x={11} y={PAD.top + plotH / 2} className="chart__axis-title" textAnchor="middle">{yLabel}</text>
        )}
      </svg>

      {hover != null && (
        <div className="tooltip" style={{ position: 'absolute', left: PAD.left + slot * hover + slot / 2, top: 2, transform: 'translate(-50%,0)' }}>
          <span className="tooltip__title">{data[hover][xKey]}</span>
          {series.map((s, si) => (
            <div key={s.key} className="row row--between row--nowrap" style={{ gap: 10 }}>
              <span className="row row--xtight row--nowrap">
                <span className="legend__swatch" style={{ background: s.color ?? seriesColor(si) }} />{s.name}
              </span>
              <span className="mono strong">{formatValue(data[hover][s.key] ?? 0)}</span>
            </div>
          ))}
        </div>
      )}

      {legend && series.length > 1 && (
        <Legend items={series.map((s, i) => ({ label: s.name, color: s.color ?? seriesColor(i) }))} />
      )}
    </div>
  );
}

/* ---------- Area ---------- */

export function AreaChart({
  data, valueKey = 'value', xKey = 'period', height = 200,
  xLabel, yLabel, color = 'var(--c-series-0)', formatValue = formatNumber,
}) {
  const [ref, W] = useElementWidth();
  const [hover, setHover] = useState(null);

  const H = height;
  const PAD = { top: 8, right: 8, bottom: xLabel ? 34 : 20, left: yLabel ? 46 : 34 };
  const plotW = Math.max(W - PAD.left - PAD.right, 10);
  const plotH = Math.max(H - PAD.top - PAD.bottom, 10);

  const max = Math.max(1, ...data.map((d) => d[valueKey] ?? 0));
  const step = 10 ** Math.floor(Math.log10(max));
  const niceMax = Math.ceil(max / step) * step || 10;

  const x = (i) => PAD.left + (data.length <= 1 ? plotW / 2 : (plotW / (data.length - 1)) * i);
  const y = (v) => PAD.top + plotH - (v / niceMax) * plotH;

  const line = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(d[valueKey] ?? 0)}`).join(' ');
  const area = data.length ? `${line} L${x(data.length - 1)},${PAD.top + plotH} L${x(0)},${PAD.top + plotH} Z` : '';
  const gid = `area-${valueKey}-${data.length}`;
  const labelEvery = Math.max(1, Math.ceil(data.length / maxTicks(plotW)));

  return (
    <div className="chart-frame" ref={ref}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label={`${yLabel ?? 'Value'} over time`} onMouseLeave={() => setHover(null)}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {[0, 1, 2].map((i) => {
          const v = (niceMax / 2) * i;
          return (
            <g key={i}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} className="chart__grid" />
              <text x={PAD.left - 6} y={y(v) + 3.5} className="chart__axis" textAnchor="end">{formatNumber(Math.round(v))}</text>
            </g>
          );
        })}

        {area && <path d={area} fill={`url(#${gid})`} />}
        {line && <path d={line} className="chart__line" stroke={color} />}

        {hover != null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + plotH} stroke="var(--c-line-strong)" strokeDasharray="3 3" />
            <circle cx={x(hover)} cy={y(data[hover][valueKey] ?? 0)} r="4" fill={color} className="chart__dot" />
          </g>
        )}

        {data.map((d, i) => (
          <rect
            key={`hit-${d[xKey]}-${i}`}
            x={x(i) - plotW / Math.max(data.length, 1) / 2}
            y={PAD.top}
            width={plotW / Math.max(data.length, 1)}
            height={plotH}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
          />
        ))}

        {data.map((d, i) => (i % labelEvery === 0 ? (
          <text key={`lbl-${d[xKey]}-${i}`} x={x(i)} y={H - (xLabel ? 20 : 6)} className="chart__axis" textAnchor="middle">{d[xKey]}</text>
        ) : null))}

        <line x1={PAD.left} x2={W - PAD.right} y1={PAD.top + plotH} y2={PAD.top + plotH} className="chart__baseline" />

        {xLabel && <text x={PAD.left + plotW / 2} y={H - 4} className="chart__axis-title" textAnchor="middle">{xLabel}</text>}
        {yLabel && (
          <text transform={`rotate(-90 11 ${PAD.top + plotH / 2})`} x={11} y={PAD.top + plotH / 2} className="chart__axis-title" textAnchor="middle">{yLabel}</text>
        )}
      </svg>

      {hover != null && (
        <div className="tooltip" style={{ position: 'absolute', left: x(hover), top: 2, transform: 'translate(-50%,0)' }}>
          <span className="tooltip__title">{data[hover][xKey]}</span>
          <span className="mono">{formatValue(data[hover][valueKey] ?? 0)}</span>
        </div>
      )}
    </div>
  );
}

/* ---------- Donut ---------- */

/**
 * One stroked circle per slice using dasharray, which makes the 2px surface gap
 * between slices trivial. Center carries the total; a dot legend sits beneath.
 */
/** `variant="pie"` is the same arc math with thickness widened to fill the
 *  full radius (a stroke from the center to the edge), center text hidden. */
export function Donut({
  data, centerValue, centerLabel, size = 170, thickness = 22,
  legend = true, colorOffset = 0, formatValue = formatNumber, variant = 'donut',
}) {
  if (variant === 'pie') thickness = size / 2;
  const [hover, setHover] = useState(null);

  const total = data.reduce((s, d) => s + d.value, 0);
  const r = (size - thickness) / 2;
  const circumference = 2 * Math.PI * r;
  const c = size / 2;
  const GAP = 2;

  let offset = 0;
  const arcs = data.map((d, i) => {
    const fraction = total ? d.value / total : 0;
    const length = Math.max(fraction * circumference - GAP, 0);
    const arc = {
      ...d,
      length,
      offset,
      fraction,
      color: d.color ?? (d.other ? 'var(--c-series-neutral)' : seriesColor(i + colorOffset)),
    };
    offset += fraction * circumference;
    return arc;
  });

  const active = hover != null ? arcs[hover] : null;

  return (
    <div className="donut">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${data.length} segments, ${total} total`}>
        <circle cx={c} cy={c} r={r} fill="none" stroke="var(--c-line)" strokeWidth={thickness} />
        <g transform={`rotate(-90 ${c} ${c})`}>
          {arcs.map((arc, i) => (
            <circle
              key={arc.label}
              cx={c} cy={c} r={r}
              fill="none"
              stroke={arc.color}
              strokeWidth={hover === i ? thickness + 3 : thickness}
              strokeDasharray={`${arc.length} ${circumference - arc.length}`}
              strokeDashoffset={-arc.offset}
              style={{ transition: 'stroke-width 120ms var(--ease)', cursor: 'pointer' }}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            >
              <title>{`${arc.label}: ${formatValue(arc.value)} (${Math.round(arc.fraction * 100)}%)`}</title>
            </circle>
          ))}
        </g>
        {variant !== 'pie' && (
          <>
            <text x={c} y={c - 1} className="donut-center__value" textAnchor="middle">
              {active ? formatValue(active.value) : (centerValue ?? formatNumber(total))}
            </text>
            <text x={c} y={c + 13} className="donut-center__label" textAnchor="middle">
              {active ? active.label : centerLabel}
            </text>
          </>
        )}
      </svg>

      {active && (
        <div className="tooltip" style={{ position: 'absolute', left: '50%', top: 2, transform: 'translate(-50%, 0)' }}>
          <span className="row row--xtight row--nowrap" style={{ gap: 6 }}>
            <span className="legend__swatch" style={{ background: active.color }} />
            <span className="tooltip__title" style={{ marginBottom: 0 }}>{active.label}</span>
          </span>
          <span className="mono strong">{formatValue(active.value)} ({Math.round(active.fraction * 100)}%)</span>
        </div>
      )}

      {legend && <Legend items={arcs.map((a) => ({ label: a.label, color: a.color }))} />}
    </div>
  );
}

/* ---------- Horizontal bar rows ---------- */

export function BarRows({ rows, formatValue = formatNumber }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="stack stack--tight">
      {rows.map((row, i) => (
        <div key={row.label} className="stack" style={{ gap: 3 }}>
          <div className="row row--between row--nowrap">
            <span className="small truncate">{row.label}</span>
            <span className="row row--xtight" style={{ flex: 'none' }}>
              {row.meta && <span className="micro subtle">{row.meta}</span>}
              <span className="mono small strong">{formatValue(row.value)}</span>
            </span>
          </div>
          <div className="meter">
            <div className="meter__fill" style={{ width: `${(row.value / max) * 100}%`, background: row.color ?? seriesColor(i) }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------- Multi-series line ---------- */

export function LineChart({
  data, series, xKey = 'period', height = 220,
  xLabel, yLabel, formatValue = formatNumber, legend = true,
}) {
  const [ref, W] = useElementWidth();
  const [hover, setHover] = useState(null);

  const H = height;
  const PAD = { top: 8, right: 8, bottom: xLabel ? 34 : 20, left: yLabel ? 46 : 34 };
  const plotW = Math.max(W - PAD.left - PAD.right, 10);
  const plotH = Math.max(H - PAD.top - PAD.bottom, 10);

  const max = Math.max(1, ...data.flatMap((d) => series.map((s) => d[s.key] ?? 0)));
  const step = 10 ** Math.floor(Math.log10(max));
  const niceMax = Math.ceil(max / step) * step || 10;

  const x = (i) => PAD.left + (data.length <= 1 ? plotW / 2 : (plotW / (data.length - 1)) * i);
  const y = (v) => PAD.top + plotH - (v / niceMax) * plotH;
  const labelEvery = Math.max(1, Math.ceil(data.length / maxTicks(plotW)));

  return (
    <div className="chart-frame" ref={ref}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label={`${yLabel ?? 'Value'} over time`} onMouseLeave={() => setHover(null)}>
        {[0, 1, 2, 3].map((i) => {
          const v = (niceMax / 3) * i;
          return (
            <g key={i}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} className="chart__grid" />
              <text x={PAD.left - 6} y={y(v) + 3.5} className="chart__axis" textAnchor="end">{formatNumber(Math.round(v))}</text>
            </g>
          );
        })}

        {series.map((s, si) => {
          const line = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(d[s.key] ?? 0)}`).join(' ');
          const color = s.color ?? seriesColor(si);
          return (
            <g key={s.key}>
              <path d={line} className="chart__line" stroke={color} />
              {data.map((d, i) => (
                <circle
                  key={i} cx={x(i)} cy={y(d[s.key] ?? 0)}
                  r={hover === i ? 4 : 2.5} fill={color}
                  style={{ transition: 'r 120ms var(--ease)' }}
                />
              ))}
            </g>
          );
        })}

        {hover != null && <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + plotH} stroke="var(--c-line-strong)" strokeDasharray="3 3" />}

        {data.map((d, i) => (
          <rect
            key={`hit-${d[xKey]}-${i}`}
            x={x(i) - plotW / Math.max(data.length, 1) / 2} y={PAD.top}
            width={plotW / Math.max(data.length, 1)} height={plotH}
            fill="transparent" onMouseEnter={() => setHover(i)}
          />
        ))}

        {data.map((d, i) => (i % labelEvery === 0 ? (
          <text key={`lbl-${d[xKey]}-${i}`} x={x(i)} y={H - (xLabel ? 20 : 6)} className="chart__axis" textAnchor="middle">{d[xKey]}</text>
        ) : null))}

        <line x1={PAD.left} x2={W - PAD.right} y1={PAD.top + plotH} y2={PAD.top + plotH} className="chart__baseline" />

        {xLabel && <text x={PAD.left + plotW / 2} y={H - 4} className="chart__axis-title" textAnchor="middle">{xLabel}</text>}
        {yLabel && (
          <text transform={`rotate(-90 11 ${PAD.top + plotH / 2})`} x={11} y={PAD.top + plotH / 2} className="chart__axis-title" textAnchor="middle">{yLabel}</text>
        )}
      </svg>

      {hover != null && (
        <div className="tooltip" style={{ position: 'absolute', left: x(hover), top: 2, transform: 'translate(-50%,0)' }}>
          <span className="tooltip__title">{data[hover][xKey]}</span>
          {series.map((s, si) => (
            <div key={s.key} className="row row--between row--nowrap" style={{ gap: 10 }}>
              <span className="row row--xtight row--nowrap">
                <span className="legend__swatch" style={{ background: s.color ?? seriesColor(si) }} />{s.name}
              </span>
              <span className="mono strong">{formatValue(data[hover][s.key] ?? 0)}</span>
            </div>
          ))}
        </div>
      )}

      {legend && series.length > 1 && (
        <Legend items={series.map((s, i) => ({ label: s.name, color: s.color ?? seriesColor(i) }))} />
      )}
    </div>
  );
}

/* ---------- Dot plot ---------- */

/** One dot per category on a shared value axis — good for spotting outliers
 *  a bar chart buries (e.g. average handle time per analyst). */
export function DotPlot({ data, xKey = 'label', valueKey = 'value', height = 220, yLabel, formatValue = formatNumber, color = 'var(--c-series-0)' }) {
  const [ref, W] = useElementWidth();
  const [hover, setHover] = useState(null);

  const H = height;
  const PAD = { top: 10, right: 10, bottom: 34, left: yLabel ? 46 : 34 };
  const plotW = Math.max(W - PAD.left - PAD.right, 10);
  const plotH = Math.max(H - PAD.top - PAD.bottom, 10);

  const values = data.map((d) => d[valueKey] ?? 0);
  const max = Math.max(1, ...values);
  const min = Math.min(0, ...values);
  const y = (v) => PAD.top + plotH - ((v - min) / (max - min || 1)) * plotH;
  const slot = plotW / Math.max(data.length, 1);
  const x = (i) => PAD.left + slot * i + slot / 2;
  const avg = values.reduce((s, v) => s + v, 0) / (values.length || 1);

  return (
    <div className="chart-frame" ref={ref}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label={`${yLabel ?? 'Value'} by ${xKey}`}>
        {[0, 1, 2, 3].map((i) => {
          const v = min + ((max - min) / 3) * i;
          return (
            <g key={i}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} className="chart__grid" />
              <text x={PAD.left - 6} y={y(v) + 3.5} className="chart__axis" textAnchor="end">{formatNumber(Math.round(v))}</text>
            </g>
          );
        })}

        <line x1={PAD.left} x2={W - PAD.right} y1={y(avg)} y2={y(avg)} stroke="var(--c-series-neutral)" strokeDasharray="3 3" />

        {data.map((d, i) => (
          <g key={d[xKey]} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            <line x1={x(i)} x2={x(i)} y1={y(0)} y2={y(d[valueKey] ?? 0)} stroke="var(--c-line-strong)" strokeWidth={1} />
            <circle cx={x(i)} cy={y(d[valueKey] ?? 0)} r={hover === i ? 7 : 5} fill={color} style={{ transition: 'r 120ms var(--ease)', cursor: 'pointer' }}>
              <title>{`${d[xKey]}: ${formatValue(d[valueKey] ?? 0)}`}</title>
            </circle>
            <text x={x(i)} y={H - 12} className="chart__axis" textAnchor="middle">{String(d[xKey]).length > 10 ? `${String(d[xKey]).slice(0, 9)}…` : d[xKey]}</text>
          </g>
        ))}

        <line x1={PAD.left} x2={W - PAD.right} y1={PAD.top + plotH} y2={PAD.top + plotH} className="chart__baseline" />

        {yLabel && (
          <text transform={`rotate(-90 11 ${PAD.top + plotH / 2})`} x={11} y={PAD.top + plotH / 2} className="chart__axis-title" textAnchor="middle">{yLabel}</text>
        )}
      </svg>

      {hover != null && (
        <div className="tooltip" style={{ position: 'absolute', left: x(hover), top: 2, transform: 'translate(-50%,0)' }}>
          <span className="tooltip__title">{data[hover][xKey]}</span>
          <span className="mono">{formatValue(data[hover][valueKey] ?? 0)}</span>
        </div>
      )}
    </div>
  );
}

/* ---------- Geographic bubble map ---------- */

/** Approximate country centroids for the ten markets the book uses — enough
 *  to place a bubble, not a survey-grade projection. */
const MARKET_COORDS = {
  US: { lon: -98, lat: 39 }, CA: { lon: -106, lat: 56 }, GB: { lon: -2, lat: 54 },
  DE: { lon: 10, lat: 51 }, FR: { lon: 2, lat: 46 }, ES: { lon: -4, lat: 40 },
  IT: { lon: 12, lat: 43 }, AU: { lon: 133, lat: -27 }, JP: { lon: 138, lat: 36 },
  MX: { lon: -102, lat: 23 },
};

export function WorldBubbleMap({ data, height = 260, formatValue = formatNumber }) {
  const [ref, W] = useElementWidth();
  const [hover, setHover] = useState(null);

  const H = height;
  const PAD = { top: 14, right: 14, bottom: 14, left: 14 };
  const plotW = Math.max(W - PAD.left - PAD.right, 10);
  const plotH = Math.max(H - PAD.top - PAD.bottom, 10);

  const project = (lon, lat) => ({
    x: PAD.left + ((lon + 180) / 360) * plotW,
    y: PAD.top + ((90 - lat) / 180) * plotH,
  });

  const rows = data.filter((d) => MARKET_COORDS[d.market]);
  const max = Math.max(1, ...rows.map((d) => d.count));
  const radius = (count) => 7 + Math.sqrt(count / max) * 20;

  return (
    <div className="chart-frame" ref={ref}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label="Cases by market">
        <rect x={PAD.left} y={PAD.top} width={plotW} height={plotH} fill="var(--c-surface-sunken)" rx={8} />
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={`v${f}`} x1={PAD.left + plotW * f} x2={PAD.left + plotW * f} y1={PAD.top} y2={PAD.top + plotH} className="chart__grid" />
        ))}
        {[0.33, 0.66].map((f) => (
          <line key={`h${f}`} x1={PAD.left} x2={PAD.left + plotW} y1={PAD.top + plotH * f} y2={PAD.top + plotH * f} className="chart__grid" />
        ))}

        {rows.map((d, i) => {
          const { x, y } = project(MARKET_COORDS[d.market].lon, MARKET_COORDS[d.market].lat);
          const r = hover === i ? radius(d.count) + 2 : radius(d.count);
          return (
            <g key={d.market} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} style={{ cursor: 'pointer' }}>
              <circle cx={x} cy={y} r={r} fill="var(--c-primary)" fillOpacity={0.72} stroke="var(--c-primary-deep)" strokeWidth={1} style={{ transition: 'r 120ms var(--ease)' }}>
                <title>{`${d.market}: ${formatNumber(d.count)} cases · ${formatValue(d.value)}`}</title>
              </circle>
              <text x={x} y={y + 3.5} textAnchor="middle" className="micro" style={{ fill: '#fff', fontWeight: 700, pointerEvents: 'none' }}>{d.market}</text>
            </g>
          );
        })}
      </svg>

      {hover != null && (() => {
        const d = rows[hover];
        const { x, y } = project(MARKET_COORDS[d.market].lon, MARKET_COORDS[d.market].lat);
        return (
          <div className="tooltip" style={{ position: 'absolute', left: x, top: y - radius(d.count) - 12, transform: 'translate(-50%, -100%)' }}>
            <span className="tooltip__title">{d.market}</span>
            <span className="mono">{formatNumber(d.count)} cases · {formatValue(d.value)}</span>
          </div>
        );
      })()}
    </div>
  );
}

export default BarChart;
