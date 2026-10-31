import { CHART_KINDS, LEGEND_SIDES } from "../engine/spec.ts";
import type { ChartKind, ChartSpec, Series } from "../engine/spec.ts";
import { isObj, isOneOf } from "../engine/guards.ts";

export interface ParsedBlock {
  spec: ChartSpec;
  /** Any CSS width from the block, for the host element. */
  width?: string;
}

export type ParseResult = { ok: true; value: ParsedBlock } | { ok: false; error: string };

const UNSUPPORTED = ["sankey"];
const KIND_LIST = "bar, line, pie, doughnut, radar or polarArea";

/** Every key the parser reads; any other key in a block is ignored. */
export const BLOCK_KEYS: readonly string[] = [
  "type", "labels", "series", "indexAxis", "stacked", "fill", "tension",
  "beginAtZero", "xTitle", "yTitle", "legend", "legendPosition", "width",
];

function fail(error: string): ParseResult {
  return { ok: false, error };
}

// YAML reads an unquoted 2024-01-05 as a Date in some parsers, and a bare 2024 as a number.
function label(v: unknown): string | undefined {
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return undefined;
}

function bool(v: unknown): boolean | undefined {
  return typeof v === "boolean" ? v : undefined;
}

function parseSeries(raw: unknown, index: number, kind: ChartKind, fill: boolean | undefined): Series | string {
  if (!isObj(raw)) return `Series ${index + 1} must have a title and data.`;
  const data = raw["data"];
  if (!Array.isArray(data)) return `Series ${index + 1} needs a data list, like data: [1, 2, 3].`;
  const values: (number | null)[] = [];
  for (const v of data) {
    if (typeof v === "number") values.push(v);
    else if (v === null || v === undefined) values.push(null);
    else return `Series ${index + 1} has a value that is not a number: ${JSON.stringify(v)}.`;
  }
  const title = label(raw["title"]);
  const series: Series = { name: title ?? `Series ${index + 1}`, values };
  if (kind === "line" && fill) series.fill = true;
  if (kind === "radar") series.fill = fill ?? true;
  return series;
}

export function parseChartBlock(input: unknown): ParseResult {
  if (!isObj(input)) return fail("The chart block is empty or is not a list of options. Start with type: bar.");

  const rawType = typeof input["type"] === "string" ? input["type"].trim() : "";
  if (!rawType) return fail(`The chart block needs a type: ${KIND_LIST}.`);
  const lower = rawType.toLowerCase();
  if (UNSUPPORTED.includes(lower)) {
    return fail(`The chart type "${rawType}" is not supported yet. Use ${KIND_LIST}.`);
  }
  // Charts spells it polarArea, but a block in any case is meant the same
  const kind = CHART_KINDS.find((k) => k.toLowerCase() === lower);
  if (!kind) {
    return fail(`Unknown chart type "${rawType}". Use ${KIND_LIST}.`);
  }

  if (input["id"] !== undefined && input["series"] === undefined) {
    return fail("Charts from a table (id:) are not supported yet. Give the block labels and series.");
  }

  const rawLabels = input["labels"];
  if (!Array.isArray(rawLabels)) return fail("The chart block needs labels, like labels: [Mon, Tue].");
  const labels: string[] = [];
  for (const l of rawLabels) {
    const s = label(l);
    if (s === undefined) return fail(`A label is not text or a number: ${JSON.stringify(l)}.`);
    labels.push(s);
  }

  const rawSeries = input["series"];
  if (!Array.isArray(rawSeries) || rawSeries.length === 0) {
    return fail("The chart block needs series, each with a title and data.");
  }
  const fill = bool(input["fill"]);
  const series: Series[] = [];
  for (let i = 0; i < rawSeries.length; i++) {
    const s = parseSeries(rawSeries[i], i, kind, fill);
    if (typeof s === "string") return fail(s);
    series.push(s);
  }

  const spec: ChartSpec = { kind, labels, series };

  if (kind === "bar" || kind === "line") {
    const axis = input["indexAxis"];
    if (axis === "y") spec.horizontal = true;
    else if (axis !== undefined && axis !== "x") return fail(`indexAxis must be x or y, not ${JSON.stringify(axis)}.`);
    if (bool(input["stacked"]) === true) spec.stacked = true;
    // The value axis is x when the bars run sideways
    const t = input[spec.horizontal ? "xTitle" : "yTitle"];
    if (typeof t === "string" && t) spec.valueTitle = t;
  }

  if (kind === "line" && typeof input["tension"] === "number") spec.tension = input["tension"];
  const zero = bool(input["beginAtZero"]);
  if (zero !== undefined) spec.beginAtZero = zero;
  const legend = bool(input["legend"]);
  const side = input["legendPosition"];
  if (legend === false) spec.legend = false;
  else if (isOneOf(LEGEND_SIDES, side)) spec.legend = side;
  else if (legend === true) spec.legend = true;

  let width: string | undefined;
  if (typeof input["width"] === "string") width = input["width"];
  else if (typeof input["width"] === "number") width = `${input["width"]}px`;

  return { ok: true, value: width ? { spec, width } : { spec } };
}
