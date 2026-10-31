import type { ChartKind, ChartSpec, DateUnit, Series, Sort } from "../engine/index.ts";

export const AGGREGATIONS = ["count", "sum", "average", "min", "max"] as const;
export type Aggregation = (typeof AGGREGATIONS)[number];

export interface Row {
  x: unknown;
  y?: unknown;
  /** Series name when the Bases view is grouped. */
  group?: string;
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
  title?: string;
  valueTitle?: string;
  /** Drop rows without an x value instead of bucketing them under "(none)". */
  skipEmpty?: boolean;
  /** Name of the single series when the rows are not grouped. */
  seriesName?: string;
  /** When every category is a date, bucket by this unit. */
  dateUnit?: DateUnit;
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

interface Bucket { sum: number; count: number; min: number; max: number }

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
      const bucket = perGroup.get(label) ?? { sum: 0, count: 0, min: Infinity, max: -Infinity };
      bucket.sum += amount;
      bucket.count += 1;
      bucket.min = Math.min(bucket.min, amount);
      bucket.max = Math.max(bucket.max, amount);
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

  const series: Series[] = groupOrder.map((group) => {
    const perGroup = buckets.get(group);
    const values = labels.map((label) => value(perGroup?.get(label), opts.aggregation));
    return { name: group || opts.seriesName || defaultName(opts.aggregation), values };
  });
  if (series.length === 0) series.push({ name: opts.seriesName ?? defaultName(opts.aggregation), values: [] });

  const onAxis = unit !== undefined && (opts.kind === "bar" || opts.kind === "line");
  if (unit && !onAxis) labels = labels.map((l) => bucketLabel(l, unit));
  const spec: ChartSpec = { kind: opts.kind, labels, series };
  if (onAxis) spec.dateUnit = unit;
  if (opts.title) spec.title = opts.title;
  if (opts.valueTitle) spec.valueTitle = opts.valueTitle;
  if (opts.horizontal) spec.horizontal = true;
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

// An empty bucket holds no notes: a count or sum of zero, but no average or extreme
function value(bucket: Bucket | undefined, aggregation: Aggregation): number | null {
  if (!bucket) return aggregation === "count" || aggregation === "sum" ? 0 : null;
  if (aggregation === "average") return bucket.sum / bucket.count;
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
