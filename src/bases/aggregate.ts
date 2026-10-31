import type { ChartKind, ChartSpec, Series } from "../engine/index.ts";

export type Aggregation = "count" | "sum" | "average";

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
  sort?: "none" | "value" | "label";
  categoryColors?: Record<string, string>;
  title?: string;
  valueTitle?: string;
  /** Drop rows without an x value instead of bucketing them under "(none)". */
  skipEmpty?: boolean;
  /** Name of the single series when the rows are not grouped. */
  seriesName?: string;
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

interface Bucket { sum: number; count: number }

export function aggregateRows(rows: Row[], opts: AggregateOptions): ChartSpec {
  const labelOrder: string[] = [];
  const seen = new Set<string>();
  const groupOrder: string[] = [];
  const buckets = new Map<string, Map<string, Bucket>>();
  const counting = opts.aggregation === "count";

  for (const row of rows) {
    let labels = xLabels(row.x);
    if (labels.length === 0) {
      if (opts.skipEmpty) continue;
      labels = [NONE_LABEL];
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
      const bucket = perGroup.get(label) ?? { sum: 0, count: 0 };
      bucket.sum += amount;
      bucket.count += 1;
      perGroup.set(label, bucket);
    }
  }

  // "(none)" is a remainder, not a category, so it trails unless the caller sorts
  const labels = labelOrder.filter((l) => l !== NONE_LABEL);
  if (seen.has(NONE_LABEL)) labels.push(NONE_LABEL);

  const series: Series[] = groupOrder.map((group) => {
    const perGroup = buckets.get(group);
    const values = labels.map((label) => {
      const bucket = perGroup?.get(label);
      if (!bucket) return 0;
      return opts.aggregation === "average" ? bucket.sum / bucket.count : bucket.sum;
    });
    return { name: group || opts.seriesName || defaultName(opts.aggregation), values };
  });
  if (series.length === 0) series.push({ name: opts.seriesName ?? defaultName(opts.aggregation), values: [] });

  const spec: ChartSpec = { kind: opts.kind, labels, series };
  if (opts.title) spec.title = opts.title;
  if (opts.valueTitle) spec.valueTitle = opts.valueTitle;
  if (opts.horizontal) spec.horizontal = true;
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

function defaultName(aggregation: Aggregation): string {
  if (aggregation === "sum") return "Sum";
  if (aggregation === "average") return "Average";
  return "Count";
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
