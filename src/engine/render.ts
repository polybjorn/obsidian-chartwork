import { Component, Events } from "obsidian";
import * as ChartJs from "chart.js";
import * as helpers from "chart.js/helpers";
import { Chart, registerables } from "chart.js";
import type { ChartComponentLike, ChartConfiguration } from "chart.js";
import { Flow, SankeyController } from "chartjs-chart-sankey";
import annotationPlugin from "chartjs-plugin-annotation";
import { buildConfig, chartHeight, fillThemeDefaults } from "./config.ts";
import { installDateAdapter } from "./date-adapter.ts";
import { errorText, showError } from "./error.ts";
import { isGone } from "./lifecycle.ts";
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

  override update(...args: Parameters<Chart["update"]>): void {
    try {
      super.update(...args);
    } catch (e) {
      if (!this.onUpdateError) throw e;
      this.onUpdateError(e);
    }
  }
}
function registerOnce(): void {
  if (registered) return;
  registered = true;
  // Every chart type and axis, since a config written for Charts may use any
  Chart.register(...registerables, annotationPlugin, SankeyController, Flow);
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

function mount(el: HTMLElement, ctx: RenderContext, build: Build, width?: string): View {
  registerOnce();
  sweepLoose();
  const wrapper = el.createDiv({ cls: "chartwork-chart" });
  if (width) wrapper.setCssProps({ width });
  const canvas = wrapper.createEl("canvas");
  let chart: Chart | null = null;
  let error: HTMLElement | null = null;
  let destroyed = false;

  const fail = (e: unknown): void => {
    // Chart.js keeps a chart that threw while drawing, and refuses the
    // canvas to the next one until it is destroyed
    Chart.getChart(canvas)?.destroy();
    chart = null;
    canvas.hide();
    wrapper.setCssProps({ height: "" });
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
      if (height !== undefined) wrapper.setCssProps({ height: `${height}px` });
      if (builtWidth !== undefined) wrapper.setCssProps({ width: builtWidth });
      // Export to PDF draws the note into a print container and prints it
      // moments later, which would catch each chart part way through its
      // opening animation. A restyle skips it too: a theme switch can fire
      // css-change twice (Style Settings re-fires it), and each replay of the
      // animation reads as the chart loading again
      if (!animate || wrapper.closest(".print")) config.options = { ...config.options, animation: false };
      const made = new GuardedChart(canvas, config);
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
    return { config: buildConfig(resolved, theme), height: chartHeight(resolved), width: width ?? "" };
  });
  return {
    update: (next) => {
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
