import type { ChartSpec, Series } from "../engine/spec.ts";

const KINDS: readonly string[] = ["bar", "line", "pie", "doughnut"];
const SORTS: readonly string[] = ["none", "value", "label"];

type Obj = Record<string, unknown>;

function fail(path: string, want: string, got: unknown): never {
  const seen = got === null ? "null" : Array.isArray(got) ? "array" : typeof got;
  throw new Error(`chartwork: ${path} must be ${want}, got ${seen}`);
}

function isObj(v: unknown): v is Obj {
  return typeof v === "object" && v !== null && !Array.isArray(v);
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
  return v as string[];
}

function series(v: unknown, path: string, labelCount: number): Series {
  if (!isObj(v)) fail(path, "an object", v);
  str(v.name, `${path}.name`);
  const values = v.values;
  if (!Array.isArray(values)) fail(`${path}.values`, "an array of numbers", values);
  values.forEach((n, i) => {
    if (n !== null && (typeof n !== "number" || !Number.isFinite(n))) fail(`${path}.values[${i}]`, "a finite number or null", n);
  });
  if (values.length !== labelCount) {
    throw new Error(`chartwork: ${path}.values has ${values.length} entries but labels has ${labelCount}`);
  }
  if (v.color !== undefined && typeof v.color !== "string") strList(v.color, `${path}.color`);
  if (v.fill !== undefined && typeof v.fill !== "boolean") fail(`${path}.fill`, "a boolean", v.fill);
  return v as unknown as Series;
}

/** Scripts pass arbitrary objects, so every field is checked before the engine sees it. */
export function validateSpec(input: unknown): ChartSpec {
  if (!isObj(input)) fail("spec", "an object", input);
  if (typeof input.kind !== "string" || !KINDS.includes(input.kind)) {
    throw new Error(`chartwork: kind must be one of ${KINDS.join(", ")}, got ${JSON.stringify(input.kind)}`);
  }
  const labels = strList(input.labels, "labels");
  if (!Array.isArray(input.series)) fail("series", "an array", input.series);
  input.series.forEach((s, i) => series(s, `series[${i}]`, labels.length));

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
  if (input.order !== undefined) strList(input.order, "order");
  if (input.categoryColors !== undefined) {
    if (!isObj(input.categoryColors)) fail("categoryColors", "an object", input.categoryColors);
    for (const [k, c] of Object.entries(input.categoryColors)) str(c, `categoryColors.${k}`);
  }
  return input as unknown as ChartSpec;
}
