import type { ChartConfiguration } from "chart.js";
import type { ChartSpec } from "../engine/spec.ts";

/** The wrapper form of unwrapRaw's input. */
export interface RawWrapper {
  chartOptions: ChartConfiguration;
  width?: string | number;
}

export type ChartInput = ChartSpec | ChartConfiguration | RawWrapper;

/**
 * Tells Chartwork's spec from a Chart.js config without guessing: a spec has
 * `kind`, a config has `type` and `data`, and the wrapper has `chartOptions`.
 * Anything with none of them goes down the spec path, whose validation says
 * what is missing.
 */
export function shapeOf(data: unknown): "spec" | "config" {
  if (typeof data !== "object" || data === null) return "spec";
  const o = data as Record<string, unknown>;
  const raw = o.chartOptions !== undefined || o.type !== undefined || o.data !== undefined;
  if (o.kind !== undefined && raw) {
    const other = o.chartOptions !== undefined ? "chartOptions" : o.type !== undefined ? "type" : "data";
    throw new Error(`chartwork: got both "kind" and "${other}"; "kind" starts a Chartwork spec and "type" with "data" a Chart.js config, so pass one`);
  }
  return raw ? "config" : "spec";
}

export interface RawChart {
  config: ChartConfiguration;
  /** CSS width for the chart, from Charts' wrapper form. */
  width?: string;
}

/**
 * Charts' renderChart takes a Chart.js config, or one wrapped as
 * `{chartOptions, width}` with a CSS width for the chart. The config itself
 * is checked by Chart.js when it draws.
 */
export function unwrapRaw(data: unknown): RawChart {
  if (typeof data !== "object" || data === null) {
    throw new Error("renderChart needs a Chart.js config object");
  }
  const o = data as Record<string, unknown>;
  if (o.chartOptions === undefined) return { config: data as ChartConfiguration };
  if (typeof o.chartOptions !== "object" || o.chartOptions === null) {
    throw new Error("chartOptions must be a Chart.js config object");
  }
  const config = o.chartOptions as ChartConfiguration;
  if (typeof o.width === "string" && o.width.trim()) return { config, width: o.width.trim() };
  if (typeof o.width === "number" && o.width > 0) return { config, width: `${o.width}px` };
  return { config };
}
