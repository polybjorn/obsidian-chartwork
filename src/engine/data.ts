import type { ChartSpec, Stepped } from "./spec.ts";

export interface PreparedSeries {
  name: string;
  values: (number | null)[];
  /** Same length as labels when the spec gave one colour per label. */
  color?: string | string[];
  fill?: boolean;
  stepped?: Stepped;
  hidden?: boolean;
  pointRadius?: number;
}

export interface PreparedData {
  labels: string[];
  series: PreparedSeries[];
}

export function onTimeAxis(spec: ChartSpec): boolean {
  return spec.dateUnit !== undefined && (spec.kind === "bar" || spec.kind === "line");
}

function sortIndices(indices: number[], spec: ChartSpec, key: (i: number) => number): number[] {
  const mode = spec.topN !== undefined ? "value" : (spec.sort ?? "none");
  if (mode === "value") return [...indices].sort((a, b) => key(b) - key(a));
  if (mode === "label" && spec.dateUnit !== undefined) {
    const at = (i: number): string => spec.labels[i] ?? "";
    return [...indices].sort((a, b) => (at(a) < at(b) ? -1 : at(a) > at(b) ? 1 : 0));
  }
  if (mode === "label") return [...indices].sort((a, b) => (spec.labels[a] ?? "").localeCompare(spec.labels[b] ?? ""));
  return indices;
}

/**
 * Selects (topN), arranges (order, sort) and appends the "other" bucket, moving
 * labels, every series' values and per-label colour arrays together. topN
 * ranks the whole input, so a label named in `order` can still be dropped.
 */
export function prepareData(spec: ChartSpec): PreparedData {
  const value = (s: number, i: number): number | null => spec.series[s]?.values[i] ?? null;
  const first = (i: number): number => value(0, i) ?? 0;

  // A line joins its points in data order, so on a time axis anything but
  // date order zigzags; ISO dates sort as text
  if (onTimeAxis(spec)) {
    spec = { ...spec, sort: "label", topN: undefined, order: undefined };
  }

  let kept = spec.labels.map((_, i) => i);
  let dropped: number[] = [];
  if (spec.topN !== undefined && spec.topN < kept.length) {
    const ranked = sortIndices(kept, spec, first);
    const n = Math.max(0, Math.floor(spec.topN));
    const keepSet = new Set(ranked.slice(0, n));
    kept = kept.filter((i) => keepSet.has(i));
    dropped = ranked.slice(n);
  }

  const pinned: number[] = [];
  for (const name of spec.order ?? []) {
    const i = kept.find((k) => spec.labels[k] === name && !pinned.includes(k));
    if (i !== undefined) pinned.push(i);
  }
  const rest = sortIndices(kept.filter((i) => !pinned.includes(i)), spec, first);
  const indices = [...pinned, ...rest];

  const hasOther = spec.other !== undefined && dropped.length > 0;
  const labels = indices.map((i) => spec.labels[i] ?? "");
  if (hasOther) labels.push(spec.other ?? "");

  const series = spec.series.map((s, si): PreparedSeries => {
    const values = indices.map((i) => value(si, i));
    if (hasOther) values.push(dropped.reduce((sum, i) => sum + (value(si, i) ?? 0), 0));
    const out: PreparedSeries = { name: s.name, values };
    if (s.fill !== undefined) out.fill = s.fill;
    if (s.stepped !== undefined) out.stepped = s.stepped;
    if (s.hidden !== undefined) out.hidden = s.hidden;
    if (s.pointRadius !== undefined) out.pointRadius = s.pointRadius;
    if (Array.isArray(s.color)) {
      const colors = indices.map((i) => s.color?.[i] ?? "");
      // An empty entry means "use the palette"; the bucket has no colour of its own.
      if (hasOther) colors.push("");
      out.color = colors;
    } else if (s.color !== undefined) {
      out.color = s.color;
    }
    return out;
  });

  return { labels, series };
}

export function allIntegers(series: { values: (number | null)[] }[]): boolean {
  return series.every((s) => s.values.every((v) => v === null || Number.isInteger(v)));
}
