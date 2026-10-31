import type { App, Component } from "obsidian";

// Every entry point (Bases view, code block, script) translates its input into
// a ChartSpec, so theming and layout are decided in the engine alone.

export const CHART_KINDS = ["bar", "line", "pie", "doughnut"] as const;
export type ChartKind = (typeof CHART_KINDS)[number];

export const SORTS = ["none", "value", "label"] as const;
export type Sort = (typeof SORTS)[number];

export const LEGEND_SIDES = ["top", "bottom", "left", "right"] as const;
export type LegendSide = (typeof LEGEND_SIDES)[number];

export interface Series {
  name: string;
  /** null leaves a gap, as in a line with a missing reading. */
  values: (number | null)[];
  /** One colour for the series, or one per label. Any CSS colour, including var(--x). */
  color?: string | string[];
  fill?: boolean;
}

export interface ChartSpec {
  kind: ChartKind;
  labels: string[];
  series: Series[];
  title?: string;
  horizontal?: boolean;
  stacked?: boolean;
  /** Print each value on its bar. Defaults to true for a single-series bar chart. */
  valueLabels?: boolean;
  /** Category order. Defaults to "none", the order the labels came in. */
  sort?: Sort;
  /** Labels to place first, in this order; the rest follow by `sort`. */
  order?: string[];
  /** Keep the N largest categories by the first series. Implies sort by value. */
  topN?: number;
  /** With topN, sum the dropped categories into one under this label. */
  other?: string;
  /** Colour per category label, for single-series bar, pie and doughnut charts. */
  categoryColors?: Record<string, string>;
  /** Axis title for the values. */
  valueTitle?: string;
  /** Start the value axis at zero. Defaults to true. */
  beginAtZero?: boolean;
  /** Line curve, 0 for straight segments. Defaults to 0.2. */
  tension?: number;
  /** Show the legend, or show it on one side. Defaults to shown when there is more than one series, and for pie and doughnut. */
  legend?: boolean | LegendSide;
  /** Horizontal bars: pixels per bar, so height follows the bar count. */
  barThickness?: number;
}

export interface RenderContext {
  app: App;
  /** The chart is destroyed when this unloads. */
  owner: Component;
  /**
   * The owner outlives the note the chart sits in, so the chart is also
   * destroyed once its element leaves the document for good.
   */
  loose?: boolean;
  /**
   * The user's default series colours, read at each draw so a change in
   * settings shows on the next redraw. Absent means the theme alone.
   */
  seriesColors?: () => string[];
}

export interface ChartHandle {
  update(spec: ChartSpec): void;
  destroy(): void;
}
