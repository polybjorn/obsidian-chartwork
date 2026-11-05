import { isObj, isOneOf } from "../engine/guards.ts";
import type { Obj } from "../engine/guards.ts";
import { AXIS_IDS, CHART_KINDS, DATE_UNITS, ISO_DATE, LEGEND_SIDES, SORTS, STEPS } from "../engine/spec.ts";
import type { AxisSpec, ChartSpec, Series } from "../engine/spec.ts";
import { unknownKeyText } from "../engine/hint.ts";

const SPEC_KEYS = [
  "kind", "labels", "series", "title", "horizontal", "stacked", "valueLabels", "sort", "order",
  "topN", "other", "categoryColors", "labelColors", "valueTitle", "beginAtZero", "tension", "legend",
  "barThickness", "axes", "spanGaps", "referenceLines", "average", "dateUnit",
  "bestFit", "bestFitTitle", "bestFitNumber", "height", "width", "cumulative",
] as const;
const SERIES_KEYS = ["name", "values", "color", "fill", "stepped", "hidden", "pointRadius"] as const;
const AXIS_KEYS = ["min", "max", "reverse", "display", "ticks", "tickPadding"] as const;

// A field added to ChartSpec or Series but not to the lists above would be
// rejected as unknown, so the build fails instead
type Complete<Keys, Listed> = [Exclude<Keys, Listed>] extends [never] ? true : never;
// xTitle, sizeTitle and points are scatter's, which the script API does not accept
const specListed: Complete<Exclude<keyof ChartSpec, "xTitle" | "sizeTitle">, (typeof SPEC_KEYS)[number]> = true;
const seriesListed: Complete<Exclude<keyof Series, "points">, (typeof SERIES_KEYS)[number]> = true;
const axisListed: Complete<keyof AxisSpec, (typeof AXIS_KEYS)[number]> = true;
void specListed;
void seriesListed;
void axisListed;

function fail(path: string, want: string, got: unknown): never {
  const seen = got === null ? "null" : Array.isArray(got) ? "array" : typeof got;
  throw new Error(`chartwork: ${path} must be ${want}, got ${seen}`);
}

interface Unknown {
  path: string;
  /** Where the field sits, as the message names it: "the spec", "series[n]", "axes.y". */
  where: string;
  known: readonly string[];
}

function unknownIn(v: unknown, known: readonly string[], prefix: string, where: string, into: Unknown[]): void {
  if (!isObj(v)) return;
  for (const key of Object.keys(v)) {
    if (!known.includes(key)) into.push({ path: `${prefix}${key}`, where, known });
  }
}

// A misspelt field would otherwise do nothing, silently. Every one in the
// spec is named in one message, with the fields valid where each sits, so a
// script is not fixed one throw at a time.
function knownFields(input: Obj): void {
  const found: Unknown[] = [];
  unknownIn(input, SPEC_KEYS, "", "the spec", found);
  if (Array.isArray(input.series)) {
    input.series.forEach((s, i) => unknownIn(s, SERIES_KEYS, `series[${i}].`, "series[n]", found));
  }
  unknownIn(input.axes, AXIS_IDS, "axes.", "axes", found);
  if (isObj(input.axes)) {
    for (const id of AXIS_IDS) unknownIn(input.axes[id], AXIS_KEYS, `axes.${id}.`, `axes.${id}`, found);
  }
  unknownIn(input.referenceLines, ["x", "y"], "referenceLines.", "referenceLines", found);
  if (found.length === 0) return;
  const names = found.map((u) => unknownKeyText(u.path.slice(u.path.lastIndexOf(".") + 1), u.known, u.path));
  const valid = new Map<string, string>();
  for (const u of found) valid.set(u.where, `${u.where} takes ${u.known.join(", ")}`);
  const plural = found.length > 1 ? "s" : "";
  throw new Error(`chartwork: unknown field${plural} ${names.join(", ")}. ${[...valid.values()].join("; ")}`);
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
  if (v.stepped !== undefined) {
    if (typeof v.stepped !== "boolean" && !isOneOf(STEPS, v.stepped)) fail(`${path}.stepped`, 'a boolean, "before", "after" or "middle"', v.stepped);
    out.stepped = v.stepped;
  }
  if (v.hidden !== undefined) {
    if (typeof v.hidden !== "boolean") fail(`${path}.hidden`, "a boolean", v.hidden);
    out.hidden = v.hidden;
  }
  if (v.pointRadius !== undefined) {
    if (typeof v.pointRadius !== "number" || !Number.isFinite(v.pointRadius) || v.pointRadius < 0) fail(`${path}.pointRadius`, "a number of 0 or more", v.pointRadius);
    out.pointRadius = v.pointRadius;
  }
  return out;
}

function axes(v: unknown): Partial<Record<(typeof AXIS_IDS)[number], AxisSpec>> {
  if (!isObj(v)) fail("axes", "an object", v);
  const out: Partial<Record<(typeof AXIS_IDS)[number], AxisSpec>> = {};
  for (const id of AXIS_IDS) {
    const a = v[id];
    if (a === undefined) continue;
    const path = `axes.${id}`;
    if (!isObj(a)) fail(path, "an object", a);
    for (const key of ["min", "max"]) {
      const b = a[key];
      if (b !== undefined && typeof b !== "string" && (typeof b !== "number" || !Number.isFinite(b))) {
        fail(`${path}.${key}`, "a finite number or a label", b);
      }
    }
    for (const key of ["reverse", "display", "ticks"]) {
      if (a[key] !== undefined && typeof a[key] !== "boolean") fail(`${path}.${key}`, "a boolean", a[key]);
    }
    const pad = a.tickPadding;
    if (pad !== undefined && (typeof pad !== "number" || !Number.isFinite(pad))) fail(`${path}.tickPadding`, "a number", pad);
    out[id] = { ...(a as AxisSpec) };
  }
  return out;
}

function referenceLines(v: unknown): Partial<Record<"x" | "y", (number | string)[]>> {
  if (!isObj(v)) fail("referenceLines", "an object", v);
  const out: Partial<Record<"x" | "y", (number | string)[]>> = {};
  for (const id of ["x", "y"] as const) {
    const list = v[id];
    if (list === undefined) continue;
    if (!Array.isArray(list)) fail(`referenceLines.${id}`, "an array of numbers or labels", list);
    list.forEach((at, i) => {
      if (typeof at !== "string" && (typeof at !== "number" || !Number.isFinite(at))) fail(`referenceLines.${id}[${i}]`, "a finite number or a label", at);
    });
    out[id] = [...(list as (number | string)[])];
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
  knownFields(input);
  if (!isOneOf(CHART_KINDS, input.kind)) {
    throw new Error(`chartwork: kind must be one of ${CHART_KINDS.join(", ")}, got ${JSON.stringify(input.kind)}`);
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
  optBool(input, "spanGaps");
  optBool(input, "labelColors");
  optBool(input, "average");
  optBool(input, "cumulative");
  optBool(input, "bestFit");
  optStr(input, "bestFitTitle");
  const fitted = input.bestFitNumber;
  if (fitted !== undefined && (typeof fitted !== "number" || !Number.isInteger(fitted) || fitted < 0 || fitted >= allSeries.length)) {
    fail("bestFitNumber", `a series index from 0 to ${allSeries.length - 1}`, fitted);
  }
  if (input.tension !== undefined && (typeof input.tension !== "number" || input.tension < 0 || input.tension > 1)) {
    fail("tension", "a number from 0 to 1", input.tension);
  }
  if (input.legend !== undefined && typeof input.legend !== "boolean" && !isOneOf(LEGEND_SIDES, input.legend)) {
    throw new Error(`chartwork: legend must be true, false or one of ${LEGEND_SIDES.join(", ")}, got ${JSON.stringify(input.legend)}`);
  }
  optNum(input, "barThickness");
  optNum(input, "height");
  if (typeof input.width === "string") {
    if (!input.width.trim()) fail("width", "a CSS width such as \"60%\" or a positive number of pixels", input.width);
  } else optNum(input, "width");
  optNum(input, "topN");
  if (input.topN !== undefined && !Number.isInteger(input.topN)) fail("topN", "a whole number", input.topN);
  if (input.sort !== undefined && !isOneOf(SORTS, input.sort)) {
    throw new Error(`chartwork: sort must be one of ${SORTS.join(", ")}, got ${JSON.stringify(input.sort)}`);
  }
  if (input.dateUnit !== undefined) {
    if (!isOneOf(DATE_UNITS, input.dateUnit)) {
      throw new Error(`chartwork: dateUnit must be one of ${DATE_UNITS.join(", ")}, got ${JSON.stringify(input.dateUnit)}`);
    }
    const bad = labels.findIndex((l) => !ISO_DATE.test(l));
    if (bad >= 0) {
      throw new Error(`chartwork: with dateUnit, labels must be ISO dates such as 2026-01-31, got ${JSON.stringify(labels[bad])} at labels[${bad}]`);
    }
  }
  const out = { ...input, labels, series: allSeries } as unknown as ChartSpec;
  if (input.order !== undefined) out.order = strList(input.order, "order");
  if (input.categoryColors !== undefined) {
    if (!isObj(input.categoryColors)) fail("categoryColors", "an object", input.categoryColors);
    for (const [k, c] of Object.entries(input.categoryColors)) str(c, `categoryColors.${k}`);
    out.categoryColors = { ...(input.categoryColors as Record<string, string>) };
  }
  if (input.axes !== undefined) out.axes = axes(input.axes);
  if (input.referenceLines !== undefined) out.referenceLines = referenceLines(input.referenceLines);
  return out;
}

// Fields that do something only on some chart kinds. A few clear cases, not
// every field: the rest apply to all kinds or say in their docs where they do.
const ONLY_FOR: Partial<Record<(typeof SPEC_KEYS)[number], readonly string[]>> = {
  horizontal: ["bar", "line"],
  stacked: ["bar", "line"],
  labelColors: ["bar"],
  barThickness: ["bar"],
  tension: ["line"],
  bestFit: ["line"],
  spanGaps: ["line", "radar"],
  referenceLines: ["bar", "line"],
  average: ["bar", "line"],
  cumulative: ["bar", "line"],
  dateUnit: ["bar", "line"],
  valueLabels: ["bar", "line", "pie", "doughnut", "polarArea"],
};

/**
 * The hint a script chart shows under itself for fields its kind does not
 * use, as horizontal on a pie. Undefined when every field set applies.
 */
export function specHint(spec: ChartSpec): string | undefined {
  const unused = Object.keys(ONLY_FOR).filter((key) => {
    const kinds = ONLY_FOR[key as keyof typeof ONLY_FOR];
    return spec[key as keyof ChartSpec] !== undefined && kinds !== undefined && !kinds.includes(spec.kind);
  });
  if (unused.length === 0) return undefined;
  const fields = unused.length < 2 ? unused.join("") : `${unused.slice(0, -1).join(", ")} or ${unused[unused.length - 1]}`;
  return `A ${spec.kind === "polarArea" ? "polar area" : spec.kind} chart doesn't use ${fields}.`;
}
