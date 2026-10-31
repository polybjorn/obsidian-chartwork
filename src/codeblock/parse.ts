import { CHART_KINDS, LEGEND_SIDES } from "../engine/spec.ts";
import type { ChartKind, ChartSpec, Series } from "../engine/spec.ts";
import { isObj, isOneOf } from "../engine/guards.ts";
import { LAYOUTS } from "./table.ts";
import type { Layout } from "./table.ts";

/** Where a table-backed block finds its numbers; labels and series come from the table. */
export interface TableRef {
  id: string;
  /** Note holding the table, as a link path. Absent means the note the block sits in. */
  file?: string;
  layout: Layout;
  select?: string[];
  fill?: boolean;
}

export interface ParsedBlock {
  spec: ChartSpec;
  /** Any CSS width from the block, for the host element. */
  width?: string;
  /** Set when the block names a table with id:. The spec then has no labels or series yet. */
  table?: TableRef;
}

export type ParseResult = { ok: true; value: ParsedBlock } | { ok: false; error: string };

const UNSUPPORTED = ["sankey"];
const KIND_LIST = "bar, line, pie, doughnut, radar or polarArea";

/** Every key the parser reads; any other key in a block is ignored. */
export const BLOCK_KEYS: readonly string[] = [
  "type", "labels", "series", "indexAxis", "stacked", "fill", "tension",
  "beginAtZero", "xTitle", "yTitle", "legend", "legendPosition", "width",
  "id", "file", "layout", "select",
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

// Radar shapes read as areas, so they fill unless the block says not to,
// while a line fills only when asked
export function seriesFill(kind: ChartKind, fill: boolean | undefined): boolean | undefined {
  if (kind === "radar") return fill ?? true;
  return kind === "line" && fill ? true : undefined;
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
  const f = seriesFill(kind, fill);
  if (f !== undefined) series.fill = f;
  return series;
}

function parseTableRef(input: Record<string, unknown>, fill: boolean | undefined): TableRef | string {
  const id = typeof input["id"] === "string" ? input["id"].trim().replace(/^\^/, "") : "";
  if (!id) return "id must be the block id of a table, like id: sales.";
  const layout = input["layout"] ?? "columns";
  if (!isOneOf(LAYOUTS, layout)) return `layout must be rows or columns, not ${JSON.stringify(layout)}.`;
  const ref: TableRef = { id, layout };
  if (fill !== undefined) ref.fill = fill;
  if (typeof input["file"] === "string" && input["file"].trim()) ref.file = input["file"].trim();
  const select = input["select"];
  if (select !== undefined) {
    const names = (Array.isArray(select) ? select : [select]).map(label);
    if (names.some((n) => n === undefined)) return "select must be a list of row or column names, like select: [Data2].";
    ref.select = names as string[];
  }
  return ref;
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

  const fill = bool(input["fill"]);
  let table: TableRef | undefined;
  let labels: string[] = [];
  const series: Series[] = [];

  if (input["id"] !== undefined && input["series"] === undefined) {
    const ref = parseTableRef(input, fill);
    if (typeof ref === "string") return fail(ref);
    table = ref;
  } else {
    const rawLabels = input["labels"];
    if (!Array.isArray(rawLabels)) return fail("The chart block needs labels, like labels: [Mon, Tue].");
    for (const l of rawLabels) {
      const s = label(l);
      if (s === undefined) return fail(`A label is not text or a number: ${JSON.stringify(l)}.`);
      labels.push(s);
    }

    const rawSeries = input["series"];
    if (!Array.isArray(rawSeries) || rawSeries.length === 0) {
      return fail("The chart block needs series, each with a title and data.");
    }
    for (let i = 0; i < rawSeries.length; i++) {
      const s = parseSeries(rawSeries[i], i, kind, fill);
      if (typeof s === "string") return fail(s);
      series.push(s);
    }
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

  const value: ParsedBlock = { spec };
  if (width) value.width = width;
  if (table) value.table = table;
  return { ok: true, value };
}
