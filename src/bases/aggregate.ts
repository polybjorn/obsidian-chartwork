import type { AxisSpec, ChartKind, ChartSpec, DateUnit, Series, Sort } from "../engine/index.ts";

export const AGGREGATIONS = ["count", "sum", "average", "min", "max"] as const;
export type Aggregation = (typeof AGGREGATIONS)[number];

export interface Row {
  x: unknown;
  y?: unknown;
  /** Series name when the Bases view is grouped. */
  group?: string;
  /** Path of the note the row came from. */
  note?: string;
}

export interface AggregateOptions {
  aggregation: Aggregation;
  kind: ChartKind;
  horizontal?: boolean;
  topN?: number;
  other?: string;
  order?: string[];
  sort?: Sort;
  categoryColors?: Record<string, string>;
  /** Color per series name, for grouped bar and line charts. */
  groupColors?: Record<string, string>;
  title?: string;
  valueTitle?: string;
  /** Drop rows without an x value instead of bucketing them under "(none)". */
  skipEmpty?: boolean;
  /** Name of the single series when the rows are not grouped. */
  seriesName?: string;
  /** When every category is a date, bucket by this unit. */
  dateUnit?: DateUnit;
  /** Bar, line: draw each series as a running total. */
  cumulative?: boolean;
  /** Left undefined, the engine decides by chart type. */
  valueLabels?: boolean;
  /** Bar, line: stack the series. */
  stacked?: boolean;
  /** Series in this order, the rest after them as found. */
  seriesOrder?: string[];
  /** Bounds of the value axis, which is x when horizontal. */
  min?: number;
  max?: number;
  beginAtZero?: boolean;
  tension?: number;
  average?: boolean;
}

export const NONE_LABEL = "(none)";

const LINK = /^!?\[\[([^\]]*)\]\]$/;

function scalarLabel(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  let text: string;
  if (typeof value === "string") text = value;
  else if (typeof value === "number" || typeof value === "boolean") text = String(value);
  else if (value instanceof Date) text = value.toISOString().slice(0, 10);
  else return null;
  text = text.trim();
  const link = LINK.exec(text);
  if (link) {
    const [target = "", alias] = (link[1] ?? "").split("|");
    const shown = alias?.trim() || target.split("#")[0]?.split("/").pop()?.replace(/\.md$/, "") || "";
    text = shown.trim();
  }
  if (text.startsWith("#")) text = text.slice(1);
  return text === "" ? null : text;
}

/** One label per list element; an empty or missing value gives the empty list. */
export function xLabels(x: unknown): string[] {
  const items = Array.isArray(x) ? x : [x];
  const labels: string[] = [];
  for (const item of items) {
    const label = scalarLabel(item);
    if (label !== null) labels.push(label);
  }
  return labels;
}

export function parseNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const text = value.trim().replace(",", ".");
  if (text === "" || !/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(text)) return null;
  return Number(text);
}

// Time and zone are dropped: the smallest bucket is a day, and the day is the
// one written in the note
const ISO_PARTS = /^(\d{4})-(\d{2})-(\d{2})(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}(?::?\d{2})?)?)?$/;

/** The local day a Date or an ISO date label names, or null. Links to daily notes count. */
export function dateOf(value: unknown): Date | null {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }
  const m = ISO_PARTS.exec(scalarLabel(value) ?? "");
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]) - 1, Number(m[3])];
  const date = new Date(y, mo, d);
  return date.getMonth() === mo && date.getDate() === d ? date : null;
}

function iso(d: Date): string {
  const pad = (n: number): string => String(n).padStart(2, "0");
  return `${String(d.getFullYear()).padStart(4, "0")}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** The first day of the bucket holding d, weeks starting on Monday. */
export function bucketStart(d: Date, unit: DateUnit): Date {
  const [y, m, day] = [d.getFullYear(), d.getMonth(), d.getDate()];
  if (unit === "week") return new Date(y, m, day - ((d.getDay() + 6) % 7));
  if (unit === "month") return new Date(y, m, 1);
  if (unit === "year") return new Date(y, 0, 1);
  return new Date(y, m, day);
}

function nextBucket(d: Date, unit: DateUnit): Date {
  const [y, m, day] = [d.getFullYear(), d.getMonth(), d.getDate()];
  if (unit === "week") return new Date(y, m, day + 7);
  if (unit === "month") return new Date(y, m + 1, 1);
  if (unit === "year") return new Date(y + 1, 0, 1);
  return new Date(y, m, day + 1);
}

/** A bucket's label where there is no time axis to format it, as in a pie. */
export function bucketLabel(start: string, unit: DateUnit): string {
  if (unit === "month") return start.slice(0, 7);
  if (unit === "year") return start.slice(0, 4);
  if (unit === "day") return start;
  const d = dateOf(start) ?? new Date(NaN);
  const thursday = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 3);
  const week = Math.floor((thursday.getTime() - new Date(thursday.getFullYear(), 0, 1).getTime()) / 864e5 / 7) + 1;
  return `${thursday.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** One row per property for a note, each its own series, named `group: property` when the view is grouped. */
export function propertyRows(x: unknown, values: unknown[], names: string[], group: string | undefined, counting: boolean, note?: string): Row[] {
  const rows: Row[] = [];
  values.forEach((y, i) => {
    // Counting per property counts the notes that fill it in
    if (counting && xLabels(y).length === 0) return;
    const name = names[i] ?? "";
    rows.push({ x, y, group: group ? `${group}: ${name}` : name, note });
  });
  return rows;
}

function items(x: unknown): unknown[] {
  return Array.isArray(x) ? x : [x];
}

function allDates(rows: Row[]): boolean {
  let any = false;
  for (const row of rows) {
    for (const item of items(row.x)) {
      if (!(item instanceof Date) && scalarLabel(item) === null) continue;
      if (!dateOf(item)) return false;
      any = true;
    }
  }
  return any;
}

// Past this many buckets an empty one is left out rather than drawn as zero
const MAX_FILLED = 5000;

interface Bucket { sum: number; count: number; min: number; max: number; places: number; notes: Set<string> }

/** Decimal places a value is written with: 2 for 1.25, 0 for 412. */
function decimalPlaces(n: number): number {
  const [mantissa = "", exponent = "0"] = String(n).toLowerCase().split("e");
  return Math.max(0, (mantissa.split(".")[1]?.length ?? 0) - Number(exponent));
}

// Pie and doughnut have no value axis, a line alone has tension
function applyValueScale(spec: ChartSpec, opts: AggregateOptions): void {
  if (spec.kind === "pie" || spec.kind === "doughnut") return;
  if (opts.min !== undefined || opts.max !== undefined) {
    const axis: AxisSpec = {};
    if (opts.min !== undefined) axis.min = opts.min;
    if (opts.max !== undefined) axis.max = opts.max;
    spec.axes = { [opts.horizontal ? "x" : "y"]: axis };
  }
  if (opts.beginAtZero !== undefined) spec.beginAtZero = opts.beginAtZero;
  if (opts.average) spec.average = true;
  if (spec.kind === "line" && opts.tension !== undefined) spec.tension = opts.tension;
}

// A hand-edited .base may carry the chart block's true and false
export function valueLabelsOption(value: unknown): boolean | undefined {
  if (value === "on" || value === true) return true;
  if (value === "off" || value === false) return false;
  return undefined;
}

export function aggregateRows(rows: Row[], opts: AggregateOptions): ChartSpec {
  const labelOrder: string[] = [];
  const seen = new Set<string>();
  const groupOrder: string[] = [];
  const buckets = new Map<string, Map<string, Bucket>>();
  const counting = opts.aggregation === "count";
  const unit = opts.dateUnit && allDates(rows) ? opts.dateUnit : undefined;

  for (const row of rows) {
    let labels: string[];
    if (unit) {
      labels = [];
      for (const item of items(row.x)) {
        const date = dateOf(item);
        if (date) labels.push(iso(bucketStart(date, unit)));
      }
      // A note with no date has no place on a time axis
      if (labels.length === 0) continue;
    } else {
      labels = xLabels(row.x);
      if (labels.length === 0) {
        if (opts.skipEmpty) continue;
        labels = [NONE_LABEL];
      }
    }
    let amount = 1;
    if (!counting) {
      const parsed = parseNumber(row.y);
      if (parsed === null) continue;
      amount = parsed;
    }
    const group = row.group ?? "";
    let perGroup = buckets.get(group);
    if (!perGroup) {
      perGroup = new Map();
      buckets.set(group, perGroup);
      groupOrder.push(group);
    }
    for (const label of labels) {
      if (!seen.has(label)) {
        seen.add(label);
        labelOrder.push(label);
      }
      const bucket = perGroup.get(label) ?? { sum: 0, count: 0, min: Infinity, max: -Infinity, places: 0, notes: new Set<string>() };
      bucket.sum += amount;
      bucket.count += 1;
      bucket.min = Math.min(bucket.min, amount);
      bucket.max = Math.max(bucket.max, amount);
      bucket.places = Math.max(bucket.places, decimalPlaces(amount));
      if (row.note !== undefined) bucket.notes.add(row.note);
      perGroup.set(label, bucket);
    }
  }

  let labels: string[];
  if (unit) {
    labels = labelOrder.sort();
    const timeAxis = opts.kind === "bar" || opts.kind === "line";
    // No notes in a week is a count of zero, which a line should drop to
    // rather than draw straight across
    if (timeAxis && (counting || opts.aggregation === "sum") && labels.length > 1) {
      const filled: string[] = [];
      const last = labels[labels.length - 1] ?? "";
      for (let d = dateOf(labels[0]); d && iso(d) <= last && filled.length <= MAX_FILLED; d = nextBucket(d, unit)) {
        filled.push(iso(d));
      }
      if (filled.length <= MAX_FILLED) labels = filled;
    }
  } else {
    // "(none)" is a remainder, not a category, so it trails unless the caller sorts
    labels = labelOrder.filter((l) => l !== NONE_LABEL);
    if (seen.has(NONE_LABEL)) labels.push(NONE_LABEL);
  }

  if (opts.seriesOrder) {
    const rank = (g: string): number => {
      const i = opts.seriesOrder?.indexOf(g) ?? -1;
      return i === -1 ? Infinity : i;
    };
    groupOrder.sort((a, b) => rank(a) - rank(b));
  }
  const series: Series[] = groupOrder.map((group) => {
    const perGroup = buckets.get(group);
    const values = labels.map((label) => value(perGroup?.get(label), opts.aggregation));
    const notes = labels.map((label) => [...(perGroup?.get(label)?.notes ?? [])]);
    return { name: group || opts.seriesName || defaultName(opts.aggregation), values, ...(notes.some((n) => n.length > 0) ? { notes } : {}) };
  });
  if (series.length === 0) series.push({ name: opts.seriesName ?? defaultName(opts.aggregation), values: [] });

  const onAxis = unit !== undefined && (opts.kind === "bar" || opts.kind === "line");
  if (unit && !onAxis) labels = labels.map((l) => bucketLabel(l, unit));
  const spec: ChartSpec = { kind: opts.kind, labels, series };
  if (onAxis) spec.dateUnit = unit;
  if (opts.title) spec.title = opts.title;
  if (opts.valueTitle) spec.valueTitle = opts.valueTitle;
  if (opts.horizontal) spec.horizontal = true;
  if (opts.cumulative && (opts.kind === "bar" || opts.kind === "line")) spec.cumulative = true;
  if (opts.valueLabels !== undefined) spec.valueLabels = opts.valueLabels;
  if (opts.stacked && (opts.kind === "bar" || opts.kind === "line")) spec.stacked = true;
  applyValueScale(spec, opts);
  applyGroupColors(spec, opts.groupColors);
  if (onAxis) return spec;
  if (opts.sort) spec.sort = opts.sort;
  if (opts.order && opts.order.length > 0) spec.order = opts.order;
  if (opts.topN && opts.topN > 0) {
    spec.topN = opts.topN;
    if (opts.other) spec.other = opts.other;
  }
  if (opts.categoryColors && Object.keys(opts.categoryColors).length > 0) {
    spec.categoryColors = opts.categoryColors;
  }
  return spec;
}

// An empty bucket holds no notes: a count or sum of zero, but no average or extreme.
// An average keeps one decimal more than its most precise input, so whole page
// counts average to 476.6 rather than 476.625
function value(bucket: Bucket | undefined, aggregation: Aggregation): number | null {
  if (!bucket) return aggregation === "count" || aggregation === "sum" ? 0 : null;
  if (aggregation === "average") return Number((bucket.sum / bucket.count).toFixed(Math.min(bucket.places + 1, 100)));
  if (aggregation === "min") return bucket.min;
  if (aggregation === "max") return bucket.max;
  return bucket.sum;
}

const NAMES: Record<Aggregation, string> = {
  count: "Count", sum: "Sum", average: "Average", min: "Minimum", max: "Maximum",
};

function defaultName(aggregation: Aggregation): string {
  return NAMES[aggregation];
}

/**
 * Pin series to colors by the name they are drawn under. Only a chart with
 * more than one series takes them, and only bar, line and scatter: a single
 * series is colored per category instead. A series not named keeps its
 * palette color, which follows its index.
 */
export function applyGroupColors(spec: ChartSpec, colors: Record<string, string> | undefined): void {
  if (!colors || spec.series.length < 2) return;
  if (spec.kind !== "bar" && spec.kind !== "line" && spec.kind !== "scatter") return;
  spec.series = spec.series.map((s) => {
    const color = Object.hasOwn(colors, s.name) ? colors[s.name] : undefined;
    return color ? { ...s, color } : s;
  });
}

/** Parse "label: colour" lines from a multitext option; malformed lines are ignored. */
export function parseCategoryColors(lines: unknown): Record<string, string> {
  const colors: Record<string, string> = {};
  if (!Array.isArray(lines)) return colors;
  for (const line of lines) {
    if (typeof line !== "string") continue;
    const at = line.indexOf(":");
    if (at < 1) continue;
    const label = line.slice(0, at).trim();
    const color = line.slice(at + 1).trim();
    if (label && color) colors[label] = color;
  }
  return colors;
}

/** Menu entries for note paths, by name. A name two notes share shows its folder too. */
export function noteEntries(paths: string[]): { path: string; title: string }[] {
  const name = (path: string): string => (path.split("/").pop() ?? path).replace(/\.md$/, "");
  const uses = new Map<string, number>();
  for (const path of paths) uses.set(name(path), (uses.get(name(path)) ?? 0) + 1);
  return paths
    .map((path) => ({ path, title: uses.get(name(path)) === 1 ? name(path) : path.replace(/\.md$/, "") }))
    .sort((a, b) => a.title.localeCompare(b.title));
}

export interface ScatterEntry {
  name: string;
  /** Path of the note the entry came from. */
  note?: string;
  x: unknown;
  y: unknown;
  size?: unknown;
  /** Series name when the Bases view is grouped. */
  group?: string;
}

export interface ScatterOptions {
  title?: string;
  xTitle?: string;
  yTitle?: string;
  sizeTitle?: string;
  /** Whether a size property is chosen; without one every point has the default radius. */
  sized?: boolean;
  /** Color per group name. */
  groupColors?: Record<string, string>;
}

export const MIN_POINT_RADIUS = 3;
export const MAX_POINT_RADIUS = 15;

/**
 * One point per note, no aggregation. A note missing x or y has no place on
 * the plot and is skipped; one missing only its size gets the middle radius.
 * Sizes scale over every note drawn, groups included, so radii compare across
 * series.
 */
export function scatterSpec(entries: ScatterEntry[], opts: ScatterOptions = {}): ChartSpec {
  const kept = entries.flatMap((e) => {
    const x = parseNumber(e.x);
    const y = parseNumber(e.y);
    return x === null || y === null ? [] : [{ name: e.name, note: e.note, x, y, size: opts.sized ? parseNumber(e.size) : null, group: e.group ?? "" }];
  });
  const sizes = kept.flatMap((p) => (p.size === null ? [] : [p.size]));
  const lo = Math.min(...sizes);
  const hi = Math.max(...sizes);
  const middle = (MIN_POINT_RADIUS + MAX_POINT_RADIUS) / 2;
  const radius = (size: number | null): number | undefined => {
    if (!opts.sized) return undefined;
    if (size === null || hi === lo) return middle;
    return MIN_POINT_RADIUS + ((size - lo) / (hi - lo)) * (MAX_POINT_RADIUS - MIN_POINT_RADIUS);
  };

  const order: string[] = [];
  const byGroup = new Map<string, Series>();
  for (const p of kept) {
    let series = byGroup.get(p.group);
    if (!series) {
      series = { name: p.group || "Notes", values: [], points: [] };
      byGroup.set(p.group, series);
      order.push(p.group);
    }
    const r = radius(p.size);
    series.points?.push({
      x: p.x, y: p.y, name: p.name, ...(r === undefined ? {} : { radius: r }), ...(p.size === null ? {} : { size: p.size }),
      ...(p.note === undefined ? {} : { note: p.note }),
    });
  }
  const series = order.flatMap((g) => byGroup.get(g) ?? []);
  const spec: ChartSpec = { kind: "scatter", labels: [], series: series.length > 0 ? series : [{ name: "Notes", values: [], points: [] }] };
  if (opts.title) spec.title = opts.title;
  if (opts.xTitle) spec.xTitle = opts.xTitle;
  if (opts.yTitle) spec.valueTitle = opts.yTitle;
  if (opts.sizeTitle) spec.sizeTitle = opts.sizeTitle;
  applyGroupColors(spec, opts.groupColors);
  return spec;
}
