import { Component, Events, Menu, Notice, Platform } from "obsidian";
import * as ChartJs from "chart.js";
import * as helpers from "chart.js/helpers";
import { Chart, Tooltip, registerables } from "chart.js";
import type { ChartComponentLike, ChartConfiguration, Plugin } from "chart.js";
import { Flow, SankeyController } from "chartjs-chart-sankey";
import annotationPlugin from "chartjs-plugin-annotation";
import { buildConfig, chartHeight, fillThemeDefaults, barSide } from "./config.ts";
import { prepareData } from "./data.ts";
import { installDateAdapter } from "./date-adapter.ts";
import { errorText, showError } from "./error.ts";
import { chartImage } from "./image.ts";
import { isGone } from "./lifecycle.ts";
import { printPixelRatio } from "./print.ts";
import { withNoteClicks } from "./notes.ts";
import type { ChartHandle, ChartSpec, RenderContext } from "./spec.ts";
import { readTheme, resolveColor, resolveConfigColors, resolveSpecColors } from "./theme.ts";
import type { Theme } from "./theme.ts";

let registered = false;

// Chart.js holds back a chart's first update until its canvas is in the page,
// and scripts draw before theirs is, so a config it rejects throws later from
// a listener of its own. That update routes the error back to the chart's
// error box; one during construction still throws to the caller.
class GuardedChart extends Chart {
  onUpdateError?: (e: unknown) => void;

  // A size Chart.js measured just before reading view took the canvas out of
  // the page can land after it. The chart then returns already at that size,
  // which Chart.js reads as nothing to redraw, and it stays blank with its
  // datasets torn down. Its own startup sizing passes no size, and must run.
  override resize(width?: number, height?: number): void {
    if (this.attached || width === undefined) super.resize(width, height);
  }

  override update(...args: Parameters<Chart["update"]>): void {
    try {
      super.update(...args);
    } catch (e) {
      if (!this.onUpdateError) throw e;
      this.onUpdateError(e);
    }
  }
}

// Chart.js holds a pointer event for the next frame, and it can land after
// reading view took the canvas out of the page. The chart's datasets are torn
// down by then, and its tooltip throws on them.
const ignoreDetachedEvents: Plugin = {
  id: "chartworkIgnoreDetachedEvents",
  beforeEvent: (chart) => (chart.attached ? undefined : false),
};

const drawnHeights = new WeakMap<Chart, number>();

// Chart.js shrinks a canvas to nothing when reading view takes it out of the
// page, and a chart sized by its aspect ratio gets its height from that
// canvas. Without a floor the section returns short, grows a frame later, and
// reading view moves the note under the reader to make up for it.
const holdHeightOffPage: Plugin = {
  id: "chartworkHoldHeightOffPage",
  resize: (chart, { size }) => {
    const wrapper = chart.canvas.parentElement;
    if (!wrapper?.classList.contains("chartwork-chart")) return;
    if (size.height > 0) {
      drawnHeights.set(chart, size.height);
      wrapper.setCssProps({ "--chartwork-chart-min-height": "" });
      return;
    }
    const drawn = drawnHeights.get(chart);
    if (drawn) wrapper.setCssProps({ "--chartwork-chart-min-height": `${drawn}px` });
  },
};

// Charts drawn for a PDF, at a pixel ratio fitted to their size once it is known
const printing = new WeakSet<Chart>();

/** Sets a chart's pixel ratio, or with none hands it back to the screen's, and resizes it when that changed. */
function setPixelRatio(chart: Chart, ratio: number | undefined): void {
  const options = chart.config.options ?? (chart.config.options = {});
  if (options.devicePixelRatio === ratio) return;
  // The config keeps it through a later update, the resolved options carry it
  // into the resize below
  if (ratio === undefined) {
    delete options.devicePixelRatio;
    delete (chart.options as { devicePixelRatio?: number }).devicePixelRatio;
  } else {
    options.devicePixelRatio = ratio;
    chart.options.devicePixelRatio = ratio;
  }
  chart.resize();
}

const printRatio = (chart: Chart): number => printPixelRatio(chart.canvas.win.devicePixelRatio, chart.width, chart.height);

// A chart for a PDF starts at the full print ratio, since it has no size yet,
// and is held to its pixel budget from its first measured size
const fitPrintRatio: Plugin = {
  id: "chartworkFitPrintRatio",
  resize: (chart) => {
    if (printing.has(chart)) setPixelRatio(chart, printRatio(chart));
  },
};

function registerOnce(): void {
  if (registered) return;
  registered = true;
  // Every chart type and axis, since a config written for Charts may use any
  Chart.register(...registerables, annotationPlugin, SankeyController, Flow, ignoreDetachedEvents, holdHeightOffPage, fitPrintRatio);
  Tooltip.positioners.barSide = barSide;
  installDateAdapter();
}

/** Hands add-on items to Chart.js, after the built-ins so an add-on may replace one. */
export function registerItems(...items: ChartComponentLike[]): void {
  registerOnce();
  Chart.register(...items);
}

/** What a CommonJS add-on file gets for its `require`; other modules are not Chartwork's to hand out. */
export function requireModule(name: string): unknown {
  // An add-on registers itself through this Chart as it loads, so the
  // built-ins go in first and cannot replace it on the first draw
  registerOnce();
  if (name === "chart.js") return ChartJs;
  if (name === "chart.js/helpers") return helpers;
  throw new Error(`chartwork.require: "${name}" is not available, only "chart.js" and "chart.js/helpers"`);
}

interface Built {
  config: ChartConfiguration;
  /** Pixels; absent when the caller's own config sizes the chart. */
  height?: number;
  /** CSS width from a spec, applied at each draw so an update can change or clear it; "" is the full width. */
  width?: string;
}

type Build = (theme: Theme, wrapper: HTMLElement) => Built;

interface View {
  redraw(): void;
  destroy(): void;
  /** Whether the last draw failed and shows an error instead. */
  failed(): boolean;
}

// Loose charts have no note to tell them it closed, so every new chart and
// every theme change checks them all
// Chartwork's own events, since a workspace event like css-change would also
// wake every other plugin listening for it
export const chartworkEvents = new Events();
export const SERIES_COLORS_CHANGED = "series-colors";

const loose = new Set<() => void>();
function sweepLoose(): void {
  for (const check of [...loose]) check();
}

async function copyImage(chart: Chart, background: string): Promise<void> {
  try {
    // The promise goes in unresolved, since Safari on iOS drops a write that
    // waits for it first
    const item = new ClipboardItem({ "image/png": chartImage(chart, background) });
    await chart.canvas.win.navigator.clipboard.write([item]);
    new Notice("Chart copied");
  } catch (e) {
    new Notice(`Could not copy the chart: ${errorText(e)}`);
  }
}

function mount(el: HTMLElement, ctx: RenderContext, build: Build, width?: string): View {
  registerOnce();
  sweepLoose();
  const wrapper = el.createDiv({ cls: "chartwork-chart" });
  if (width) wrapper.setCssProps({ "--chartwork-chart-width": width });
  const canvas = wrapper.createEl("canvas");
  let chart: Chart | null = null;
  let error: HTMLElement | null = null;
  let destroyed = false;
  // Between beforeprint and afterprint, for a print of the note as it is on screen
  let printNow = false;

  const fail = (e: unknown): void => {
    // Chart.js keeps a chart that threw while drawing, and refuses the
    // canvas to the next one until it is destroyed
    Chart.getChart(canvas)?.destroy();
    chart = null;
    canvas.hide();
    wrapper.setCssProps({ "--chartwork-chart-height": "" });
    error?.remove();
    error = showError(wrapper, errorText(e));
  };

  const redraw = (animate = true): void => {
    if (destroyed) return;
    try {
      // Built before the old chart goes, so a spec that fails to build
      // leaves nothing half drawn
      const { config, height, width: builtWidth } = build(readTheme(wrapper, ctx.seriesColors?.()), wrapper);
      chart?.destroy();
      chart = null;
      error?.remove();
      error = null;
      canvas.show();
      if (height !== undefined) wrapper.setCssProps({ "--chartwork-chart-height": `${height}px` });
      if (builtWidth !== undefined) wrapper.setCssProps({ "--chartwork-chart-width": builtWidth });
      // Export to PDF draws the note into a print container and prints it
      // moments later, which would catch each chart part way through its
      // opening animation. A restyle skips it too: a theme switch can fire
      // css-change twice (Style Settings re-fires it), and each replay of the
      // animation reads as the chart loading again
      const forPrint = printNow || wrapper.closest(".print") !== null;
      if (!animate || forPrint) config.options = { ...config.options, animation: false };
      // 300 ppi or more in the PDF rather than the screen's ratio, which a
      // zoom into the page shows as soft. Obsidian's export shrinks the page
      // to fit the paper, so a PDF measures above 300
      if (forPrint) config.options = { ...config.options, devicePixelRatio: printPixelRatio(wrapper.win.devicePixelRatio, 0, 0) };
      const made = new GuardedChart(canvas, config);
      if (forPrint) printing.add(made);
      made.onUpdateError = fail;
      chart = made;
    } catch (e) {
      fail(e);
    }
  };

  // A child of the owner rather than the owner itself, so a chart destroyed
  // early takes its listener and cleanup along instead of leaving them on an
  // owner that may live as long as the plugin
  const life = new Component();
  let shown = false;
  const check = (): void => {
    if (canvas.isConnected) shown = true;
    // Code blocks and scripts draw before their element is attached, so only
    // a chart that has been on screen counts as gone
    else if (shown && isGone(wrapper)) destroy();
  };

  const destroy = (): void => {
    if (destroyed) return;
    destroyed = true;
    loose.delete(check);
    chart?.destroy();
    chart = null;
    wrapper.remove();
    ctx.owner.removeChild(life);
  };

  const onStyle = (): void => {
    if (ctx.loose) check();
    // A note's chart redraws even while out of view, so it is right when it
    // comes back; the theme is then read from the document
    redraw(false);
  };
  life.registerEvent(ctx.app.workspace.on("css-change", onStyle));
  life.registerEvent(chartworkEvents.on(SERIES_COLORS_CHANGED, onStyle));
  life.registerDomEvent(canvas, "contextmenu", (event) => {
    event.preventDefault();
    // The view around the chart would open a menu of its own as well
    event.stopPropagation();
    new Menu()
      .addItem((item) => item.setTitle("Copy chart as image").setIcon("image").onClick(() => {
        if (chart) void copyImage(chart, readTheme(wrapper, ctx.seriesColors?.()).background);
      }))
      .showAtMouseEvent(event);
  });
  // Whether Export to PDF prints a copy of the note or the note itself, the
  // charts on screen are redrawn sharper for it and handed back after
  life.registerDomEvent(wrapper.win, "beforeprint", () => {
    printNow = true;
    if (!chart || printing.has(chart)) return;
    printing.add(chart);
    setPixelRatio(chart, printRatio(chart));
  });
  life.registerDomEvent(wrapper.win, "afterprint", () => {
    printNow = false;
    if (!chart || wrapper.closest(".print")) return;
    printing.delete(chart);
    setPixelRatio(chart, undefined);
  });
  life.register(destroy);
  ctx.owner.addChild(life);
  if (ctx.loose) {
    loose.add(check);
    window.setTimeout(check, 0);
  }

  redraw();
  return { redraw: () => redraw(), destroy, failed: () => error !== null };
}

export function renderSpec(el: HTMLElement, spec: ChartSpec, ctx: RenderContext): ChartHandle {
  let current = spec;
  const view = mount(el, ctx, (theme, wrapper) => {
    const resolved = resolveSpecColors(current, wrapper);
    const width = typeof resolved.width === "number" ? `${resolved.width}px` : resolved.width?.trim();
    const config = buildConfig(resolved, theme);
    return {
      config: ctx.openNotes ? withNoteClicks(config, prepareData(resolved), ctx.openNotes, Platform.isMobile) : config,
      height: chartHeight(resolved),
      width: width ?? "",
    };
  });
  return {
    update: (next) => {
      // Bases updates a view twice for one change to its options, about a
      // second apart, and every redraw replays the chart's opening animation
      if (!view.failed() && JSON.stringify(next) === JSON.stringify(current)) return;
      current = next;
      view.redraw();
    },
    destroy: () => view.destroy(),
  };
}

export interface ConfigHandle {
  /** Redraws with a new config; the width given at the start stays. */
  update(config: ChartConfiguration): void;
  destroy(): void;
  /** Whether the last draw failed and shows an error instead. */
  failed(): boolean;
}

/**
 * Draws a raw Chart.js config with theme colours filled in wherever it left
 * them unset. A config that fails to draw still gives a handle, with the error
 * shown in its place, so an update can try again.
 */
export function drawConfig(el: HTMLElement, config: ChartConfiguration, ctx: RenderContext, width?: string): ConfigHandle {
  let current = config;
  const view = mount(el, ctx, (theme, wrapper) => ({
    config: fillThemeDefaults(resolveConfigColors(current, (c) => resolveColor(c, wrapper)), theme),
  }), width);
  return {
    update: (next) => {
      current = next;
      view.redraw();
    },
    destroy: () => view.destroy(),
    failed: () => view.failed(),
  };
}

/**
 * Like drawConfig for Charts' renderChart: `update` ignores its spec, since a
 * raw config has none to apply, and a config that fails to draw gives null.
 */
export function renderConfig(el: HTMLElement, config: ChartConfiguration, ctx: RenderContext, width?: string): ChartHandle | null {
  const drawn = drawConfig(el, config, ctx, width);
  if (drawn.failed()) return null;
  return { update: () => drawn.update(config), destroy: () => drawn.destroy() };
}
