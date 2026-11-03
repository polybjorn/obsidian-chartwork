import type { App, Component } from "obsidian";

// Every entry point (Bases view, code block, script) translates its input into
// a ChartSpec, so theming and layout are decided in the engine alone.

export const CHART_KINDS = ["bar", "line", "pie", "doughnut", "radar", "polarArea"] as const;
// Scatter stays out of CHART_KINDS, which the code block and the script API
// accept: they have no way to give points, so only the Bases view builds one.
export type ChartKind = (typeof CHART_KINDS)[number] | "scatter";

export const SORTS = ["none", "value", "label"] as const;
export type Sort = (typeof SORTS)[number];

export const LEGEND_SIDES = ["top", "bottom", "left", "right"] as const;
export type LegendSide = (typeof LEGEND_SIDES)[number];

export const DATE_UNITS = ["day", "week", "month", "year"] as const;
export type DateUnit = (typeof DATE_UNITS)[number];

/** An ISO date, optionally with a time: what a time axis reads from a label. */
export const ISO_DATE = /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?)?$/;

export const AXIS_IDS = ["x", "y", "r"] as const;
export type AxisId = (typeof AXIS_IDS)[number];

/** One axis as Chart.js names it: x runs across and y up, whichever holds the values; r is the radar and polar area scale. */
export interface AxisSpec {
  /** Lowest value shown. On a category axis, a label or its index. */
  min?: number | string;
  /** Highest value shown. On a category axis, a label or its index. */
  max?: number | string;
  /** Run the axis the other way. */
  reverse?: boolean;
  /** false hides the axis, ticks and title included. */
  display?: boolean;
  /** false hides the tick labels. */
  ticks?: boolean;
  /** Pixels between the tick labels and the axis. */
  tickPadding?: number;
}

export const STEPS = ["before", "after", "middle"] as const;
export type Stepped = boolean | (typeof STEPS)[number];

/** One scatter point: where it sits, its note's name for the tooltip, and an optional radius in pixels. */
export interface ScatterPoint {
  x: number;
  y: number;
  name: string;
  radius?: number;
}

export interface Series {
  name: string;
  /** Scatter: the points. `values` is then empty and `labels` unused. */
  points?: ScatterPoint[];
  /** null leaves a gap, as in a line with a missing reading. */
  values: (number | null)[];
  /** One colour for the series, or one per label. Any CSS colour, including var(--x). */
  color?: string | string[];
  /** Line: fill under the line. Radar: fill the shape, which is the default. */
  fill?: boolean;
  /** Line: draw steps, rising at the point (true or "before"), after it, or midway. */
  stepped?: Stepped;
  /** Bar, line, radar: start switched off; the legend turns it on. */
  hidden?: boolean;
  /** Line, radar: dot size in pixels, 0 for none. */
  pointRadius?: number;
}

export interface ChartSpec {
  kind: ChartKind;
  labels: string[];
  series: Series[];
  title?: string;
  horizontal?: boolean;
  stacked?: boolean;
  /** Print each value on its bar, slice or line point. Defaults to true for a single-series bar chart. */
  valueLabels?: boolean;
  /** Category order. Defaults to "none", the order the labels came in. */
  sort?: Sort;
  /** Labels to place first, in this order; the rest follow by `sort`. */
  order?: string[];
  /** Keep the N largest categories by the first series. Implies sort by value. */
  topN?: number;
  /** With topN, sum the dropped categories into one under this label. */
  other?: string;
  /** Colour per category label, for single-series bar, pie, doughnut and polar area charts. */
  categoryColors?: Record<string, string>;
  /** A bar chart takes one color per label, as a pie does, whatever its series count. */
  labelColors?: boolean;
  /** Scatter: axis title for x. */
  xTitle?: string;
  /** Axis title for the values. */
  valueTitle?: string;
  /** Start the value axis, or radial scale, at zero. Defaults to true. */
  beginAtZero?: boolean;
  /** Line curve, 0 for straight segments. Defaults to 0.2. */
  tension?: number;
  /** Line, radar: join the line across a missing value instead of leaving a gap. */
  spanGaps?: boolean;
  /** Show the legend, or show it on one side. Defaults to shown when there is more than one series, and for pie, doughnut and polar area. */
  legend?: boolean | LegendSide;
  /** Range, direction and visibility per axis. */
  axes?: Partial<Record<AxisId, AxisSpec>>;
  /** Chart height in pixels. Wins over the default and over the height horizontal bars grow to. */
  height?: number;
  /** Chart width, as CSS (`"60%"`) or a number of pixels. Default is the full width. */
  width?: string | number;
  /** Horizontal bars: pixels per label, plus 3/7 of it for each further series side by side, so height follows the bar count. */
  barThickness?: number;
  /** Bar, line: dashed lines across the chart where an axis reads these values, or these labels on the label axis. */
  referenceLines?: Partial<Record<"x" | "y", (number | string)[]>>;
  /**
   * Bar, line: the labels are ISO dates, drawn on a time axis in steps of this
   * unit, in date order. Sort, order and topN are ignored.
   */
  dateUnit?: DateUnit;
  /** Bar, line: replace each series by its running sum in drawn order, after sort and topN. A null adds nothing and stays a gap. */
  cumulative?: boolean;
  /** Bar, line: a dashed line at each series' mean, in its color. */
  average?: boolean;
  /** Line: a straight trend line fitted to one series by least squares. */
  bestFit?: boolean;
  /** Legend name of the trend line. Default "Line of Best Fit". */
  bestFitTitle?: string;
  /** Which series the trend line fits, counting from 0. Default 0. */
  bestFitNumber?: number;
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
