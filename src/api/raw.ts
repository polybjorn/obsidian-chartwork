import type { ChartConfiguration } from "chart.js";

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
