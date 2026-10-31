import type { ChartSpec, Series } from "../engine/spec.ts";

const KINDS: readonly string[] = ["bar", "line", "pie", "doughnut"];
const SORTS: readonly string[] = ["none", "value", "label"];

const SPEC_KEYS = [
  "kind", "labels", "series", "title", "horizontal", "stacked", "valueLabels", "sort", "order",
  "topN", "other", "categoryColors", "valueTitle", "beginAtZero", "tension", "legend", "barThickness",
] as const;
const SERIES_KEYS = ["name", "values", "color", "fill"] as const;

// A field added to ChartSpec or Series but not to the lists above would be
// rejected as unknown, so the build fails instead
type Complete<Keys, Listed> = [Exclude<Keys, Listed>] extends [never] ? true : never;
const specListed: Complete<keyof ChartSpec, (typeof SPEC_KEYS)[number]> = true;
const seriesListed: Complete<keyof Series, (typeof SERIES_KEYS)[number]> = true;
void specListed;
void seriesListed;

type Obj = Record<string, unknown>;

function fail(path: string, want: string, got: unknown): never {
  const seen = got === null ? "null" : Array.isArray(got) ? "array" : typeof got;
  throw new Error(`chartwork: ${path} must be ${want}, got ${seen}`);
}

function isObj(v: unknown): v is Obj {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

// A misspelt field would otherwise do nothing, silently
function knownKeys(o: Obj, known: readonly string[], prefix: string): void {
  for (const key of Object.keys(o)) {
    if (!known.includes(key)) throw new Error(`chartwork: unknown field ${prefix}${key}`);
  }
}

function str(v: unknown, path: string): string {
  if (typeof v !== "string") fail(path, "a string", v);
  return v;
}

function optBool(o: Obj, key: string): void {
  if (o[key] !== undefined && typeof o[key] !== "boolean") fail(key, "a boolean", o[key]);
}

function optStr(o: Obj, key: string): void {
  if (o[key] !== undefined) str(o[key], key);
}

function optNum(o: Obj, key: string): void {
  const v = o[key];
  if (v === undefined) return;
  if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) fail(key, "a positive number", v);
}

function strList(v: unknown, path: string): string[] {
  if (!Array.isArray(v)) fail(path, "an array of strings", v);
  v.forEach((item, i) => str(item, `${path}[${i}]`));
  return [...(v as string[])];
}

function series(v: unknown, path: string, labelCount: number): Series {
  if (!isObj(v)) fail(path, "an object", v);
  knownKeys(v, SERIES_KEYS, `${path}.`);
  const name = str(v.name, `${path}.name`);
  const values = v.values;
  if (!Array.isArray(values)) fail(`${path}.values`, "an array of numbers", values);
  values.forEach((n, i) => {
    if (n !== null && (typeof n !== "number" || !Number.isFinite(n))) fail(`${path}.values[${i}]`, "a finite number or null", n);
  });
  if (values.length !== labelCount) {
    throw new Error(`chartwork: ${path}.values has ${values.length} entries but labels has ${labelCount}`);
  }
  const out: Series = { name, values: [...(values as (number | null)[])] };
  if (v.color !== undefined) out.color = typeof v.color === "string" ? v.color : strList(v.color, `${path}.color`);
  if (v.fill !== undefined) {
    if (typeof v.fill !== "boolean") fail(`${path}.fill`, "a boolean", v.fill);
    out.fill = v.fill;
  }
  return out;
}

/**
 * Scripts pass arbitrary objects, so every field is checked before the engine
 * sees it. The result is a copy: the engine redraws from it on a theme change,
 * after the script may have changed its own object.
 */
export function validateSpec(input: unknown): ChartSpec {
  if (!isObj(input)) fail("spec", "an object", input);
  knownKeys(input, SPEC_KEYS, "");
  if (typeof input.kind !== "string" || !KINDS.includes(input.kind)) {
    throw new Error(`chartwork: kind must be one of ${KINDS.join(", ")}, got ${JSON.stringify(input.kind)}`);
  }
  const labels = strList(input.labels, "labels");
  if (!Array.isArray(input.series)) fail("series", "an array", input.series);
  const allSeries = input.series.map((s, i) => series(s, `series[${i}]`, labels.length));

  optStr(input, "title");
  optStr(input, "other");
  optStr(input, "valueTitle");
  optBool(input, "horizontal");
  optBool(input, "stacked");
  optBool(input, "valueLabels");
  optBool(input, "beginAtZero");
  if (input.tension !== undefined && (typeof input.tension !== "number" || input.tension < 0 || input.tension > 1)) {
    fail("tension", "a number from 0 to 1", input.tension);
  }
  const sides = ["top", "bottom", "left", "right"];
  if (input.legend !== undefined && typeof input.legend !== "boolean" && !sides.includes(input.legend as string)) {
    throw new Error(`chartwork: legend must be true, false or one of ${sides.join(", ")}, got ${JSON.stringify(input.legend)}`);
  }
  optNum(input, "barThickness");
  optNum(input, "topN");
  if (input.topN !== undefined && !Number.isInteger(input.topN)) fail("topN", "a whole number", input.topN);
  if (input.sort !== undefined && (typeof input.sort !== "string" || !SORTS.includes(input.sort))) {
    throw new Error(`chartwork: sort must be one of ${SORTS.join(", ")}, got ${JSON.stringify(input.sort)}`);
  }
  const out = { ...input, labels, series: allSeries } as unknown as ChartSpec;
  if (input.order !== undefined) out.order = strList(input.order, "order");
  if (input.categoryColors !== undefined) {
    if (!isObj(input.categoryColors)) fail("categoryColors", "an object", input.categoryColors);
    for (const [k, c] of Object.entries(input.categoryColors)) str(c, `categoryColors.${k}`);
    out.categoryColors = { ...(input.categoryColors as Record<string, string>) };
  }
  return out;
}
