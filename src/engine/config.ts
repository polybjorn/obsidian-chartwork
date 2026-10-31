import type { BarElement, ChartConfiguration, Plugin } from "chart.js";
import { allIntegers, prepareData } from "./data.ts";
import type { PreparedData } from "./data.ts";
import type { ChartSpec } from "./spec.ts";
import type { Theme } from "./theme.ts";

type Obj = Record<string, unknown>;

export const DEFAULT_BAR_THICKNESS = 28;
const DEFAULT_HEIGHT = 300;

function isPlain(v: unknown): v is Obj {
  return typeof v === "object" && v !== null && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;
}

// Chart.js parses colours itself and knows no color-mix(), so translucency is
// added to the hex or rgb() value that readTheme normalised the theme to.
export function withAlpha(color: string, alpha: number): string {
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim());
  if (hex?.[1]) {
    const h = hex[1].length === 3 ? [...hex[1]].map((c) => c + c).join("") : hex[1];
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  const rgb = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(color.trim());
  if (rgb) return `rgba(${rgb[1]}, ${rgb[2]}, ${rgb[3]}, ${alpha})`;
  return color;
}

export function wantsValueLabels(spec: ChartSpec): boolean {
  return spec.valueLabels ?? (spec.kind === "bar" && spec.series.length === 1);
}

function colorFor(spec: ChartSpec, theme: Theme, data: PreparedData, si: number): string | string[] {
  const series = data.series[si];
  const pick = (i: number): string => theme.palette[i % theme.palette.length] ?? "#888888";
  const perLabel = spec.kind === "pie" || spec.kind === "doughnut" ||
    (spec.kind === "bar" && data.series.length === 1);

  if (!perLabel) return (typeof series?.color === "string" ? series.color : undefined) ?? pick(si);

  const base = typeof series?.color === "string" ? series.color : undefined;
  const hasPerLabel = Array.isArray(series?.color) || spec.categoryColors !== undefined;
  if (!hasPerLabel && spec.kind === "bar") return base ?? pick(0);

  return data.labels.map((label, j) => {
    const fromArray = Array.isArray(series?.color) ? series.color[j] : undefined;
    return spec.categoryColors?.[label] ?? (fromArray || undefined) ?? base ?? pick(j);
  });
}

interface LabelStyle {
  color: string;
  font: string;
  horizontal: boolean;
  stacked: boolean;
}

// Chart.js has no always-on value labels, and a dependency for one draw call
// is not worth it.
function valueLabelsPlugin(style: LabelStyle): Plugin {
  return {
    id: "chartworkValueLabels",
    afterDatasetsDraw(chart) {
      const ctx = chart.ctx;
      ctx.save();
      ctx.font = `bold 12px ${style.font}`;
      ctx.fillStyle = style.color;
      chart.data.datasets.forEach((ds, i) => {
        if (!chart.isDatasetVisible(i)) return;
        chart.getDatasetMeta(i).data.forEach((el, j) => {
          const v = ds.data[j];
          if (typeof v !== "number") return;
          const bar = el as BarElement & { base: number };
          const text = String(v);
          const neg = v < 0;
          if (style.stacked) {
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            const mid = style.horizontal ? (bar.x + bar.base) / 2 : (bar.y + bar.base) / 2;
            if (style.horizontal) ctx.fillText(text, mid, bar.y);
            else ctx.fillText(text, bar.x, mid);
          } else if (style.horizontal) {
            ctx.textAlign = neg ? "right" : "left";
            ctx.textBaseline = "middle";
            ctx.fillText(text, bar.x + (neg ? -6 : 6), bar.y);
          } else {
            ctx.textAlign = "center";
            ctx.textBaseline = neg ? "top" : "bottom";
            ctx.fillText(text, bar.x, bar.y + (neg ? 4 : -4));
          }
        });
      });
      ctx.restore();
    },
  };
}

export function buildConfig(spec: ChartSpec, theme: Theme): ChartConfiguration {
  const data = prepareData(spec);
  const cartesian = spec.kind === "bar" || spec.kind === "line";
  const horizontal = cartesian && spec.horizontal === true;
  const stacked = cartesian && spec.stacked === true;
  const labelsOn = spec.kind === "bar" && wantsValueLabels(spec);

  const datasets = data.series.map((s, si) => {
    const color = colorFor(spec, theme, data, si);
    if (spec.kind === "line") {
      const c = Array.isArray(color) ? color[0] : color;
      return {
        label: s.name,
        data: s.values,
        borderColor: c,
        backgroundColor: s.fill ? withAlpha(c ?? "#888888", 0.25) : c,
        fill: s.fill === true,
        tension: spec.tension ?? 0.2,
        spanGaps: false,
      };
    }
    if (spec.kind === "bar") {
      return { label: s.name, data: s.values, backgroundColor: color, borderWidth: 0 };
    }
    return { label: s.name, data: s.values, backgroundColor: color, borderColor: theme.background, borderWidth: 2 };
  });

  const maxLabel = Math.max(0, ...data.series.flatMap((s) => s.values.map((v) => (v === null ? 0 : String(v).length))));
  const padding = labelsOn
    ? horizontal ? { right: 12 + maxLabel * 8 } : { top: 20 }
    : undefined;

  const plugins: Obj = {
    legend: {
      display: spec.legend === undefined
        ? spec.kind === "pie" || spec.kind === "doughnut" || data.series.length > 1
        : spec.legend !== false,
      ...(typeof spec.legend === "string" ? { position: spec.legend } : {}),
      labels: { color: theme.text },
    },
    title: { display: Boolean(spec.title), text: spec.title ?? "", color: theme.text },
  };

  const options: Obj = {
    responsive: true,
    maintainAspectRatio: false,
    color: theme.text,
    font: { family: theme.font },
    plugins,
  };
  if (padding) options.layout = { padding };

  if (cartesian) {
    const integers = allIntegers(data.series);
    const valueAxis: Obj = {
      beginAtZero: spec.beginAtZero ?? true,
      grace: "5%",
      stacked,
      ticks: { color: theme.text, ...(integers ? { precision: 0 } : {}) },
      grid: { color: theme.grid },
    };
    if (spec.valueTitle) valueAxis.title = { display: true, text: spec.valueTitle, color: theme.text };
    const categoryAxis: Obj = {
      stacked,
      ticks: { color: theme.text },
      grid: horizontal ? { display: false } : { color: theme.grid },
    };
    options.indexAxis = horizontal ? "y" : "x";
    options.scales = horizontal ? { x: valueAxis, y: categoryAxis } : { x: categoryAxis, y: valueAxis };
  }

  return {
    type: spec.kind,
    data: { labels: data.labels, datasets },
    options,
    plugins: labelsOn
      ? [valueLabelsPlugin({ color: theme.text, font: theme.font, horizontal, stacked })]
      : [],
  };
}

/** Wrapper height in pixels. Horizontal bars get one fixed slot per bar. */
export function chartHeight(spec: ChartSpec): number {
  if (!(spec.kind === "bar" && spec.horizontal === true)) return DEFAULT_HEIGHT;
  const count = prepareData(spec).labels.length;
  const room = 56 + (spec.title ? 32 : 0) + (spec.valueTitle ? 24 : 0);
  return count * (spec.barThickness ?? DEFAULT_BAR_THICKNESS) + room;
}

// Returns a new object tree where defaults fill only what the caller left
// undefined; plain objects merge, arrays and everything else are the caller's.
export function fillDefaults<T>(target: T, defaults: unknown): T {
  if (target === undefined) return defaults as T;
  if (!isPlain(target) || !isPlain(defaults)) return target;
  const out: Obj = { ...target };
  for (const [key, value] of Object.entries(defaults)) {
    out[key] = fillDefaults(out[key], value);
  }
  return out as T;
}

const CARTESIAN = new Set(["bar", "line", "scatter", "bubble"]);
const RADIAL = new Set(["radar", "polarArea"]);
// One colour per data point rather than per dataset
const PER_POINT = new Set(["pie", "doughnut", "polarArea"]);

/** Theme colours for a raw Chart.js config, without touching anything it already sets. */
export function fillThemeDefaults(config: ChartConfiguration, theme: Theme): ChartConfiguration {
  const type = String(config.type);
  const axis = {
    ticks: { color: theme.text },
    grid: { color: theme.grid },
    title: { color: theme.text },
  };
  const defaults: Obj = {
    color: theme.text,
    font: { family: theme.font },
    plugins: {
      legend: { labels: { color: theme.text } },
      title: { color: theme.text },
    },
  };
  const options: Obj = config.options ?? {};
  if (CARTESIAN.has(type)) {
    // Only axes that exist: an option block for an unused id would add an
    // empty axis. A config that names one axis still draws the other.
    const scales = isPlain(options.scales) ? options.scales : {};
    const names = new Set(Object.keys(scales));
    for (const d of config.data.datasets as unknown as Obj[]) {
      names.add(typeof d.xAxisID === "string" ? d.xAxisID : "x");
      names.add(typeof d.yAxisID === "string" ? d.yAxisID : "y");
    }
    if (names.size === 0) ["x", "y"].forEach((n) => names.add(n));
    defaults.scales = Object.fromEntries([...names].map((n) => [n, axis]));
  } else if (RADIAL.has(type)) {
    defaults.scales = {
      r: {
        // Chart.js backs radial tick labels with white, which shows on a dark theme
        ticks: { color: theme.text, backdropColor: "transparent" },
        grid: { color: theme.grid },
        angleLines: { color: theme.grid },
        pointLabels: { color: theme.text },
      },
    };
  }

  const paint = (i: number): string => theme.palette[i % theme.palette.length] ?? "#888888";
  const datasets = config.data.datasets.map((ds, i) => {
    const d = ds as unknown as Obj;
    if (PER_POINT.has(type)) {
      const n = Array.isArray(d.data) ? d.data.length : 0;
      return {
        ...d,
        backgroundColor: d.backgroundColor ?? Array.from({ length: n }, (_, j) => paint(j)),
        borderColor: d.borderColor ?? theme.background,
      };
    }
    if (d.backgroundColor !== undefined || d.borderColor !== undefined) return d;
    if (type === "bar") return { ...d, backgroundColor: paint(i) };
    // A radar or bubble fill covers what lies under it unless it lets it show through
    const fill = type === "radar" || type === "bubble" ? withAlpha(paint(i), 0.3) : paint(i);
    return { ...d, borderColor: paint(i), backgroundColor: fill };
  });

  return {
    ...config,
    data: { ...config.data, datasets },
    options: fillDefaults(options, defaults),
  } as unknown as ChartConfiguration;
}
