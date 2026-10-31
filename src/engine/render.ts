import { Component } from "obsidian";
import { Chart, registerables } from "chart.js";
import type { ChartConfiguration } from "chart.js";
import { buildConfig, chartHeight, fillThemeDefaults } from "./config.ts";
import { installDateAdapter } from "./date-adapter.ts";
import { errorText, showError } from "./error.ts";
import { isGone } from "./lifecycle.ts";
import type { ChartHandle, ChartSpec, RenderContext } from "./spec.ts";
import { readTheme, resolveSpecColors } from "./theme.ts";
import type { Theme } from "./theme.ts";

let registered = false;
function registerOnce(): void {
  if (registered) return;
  registered = true;
  // Every chart type and axis, since a config written for Charts may use any
  Chart.register(...registerables);
  installDateAdapter();
}

interface Built {
  config: ChartConfiguration;
  /** Pixels; absent when the caller's own config sizes the chart. */
  height?: number;
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
const loose = new Set<() => void>();
function sweepLoose(): void {
  for (const check of [...loose]) check();
}

function mount(el: HTMLElement, ctx: RenderContext, build: Build, width?: string): View {
  registerOnce();
  sweepLoose();
  const wrapper = el.createDiv({ cls: "chartwork-chart" });
  if (width) wrapper.setCssProps({ width, "margin-inline": "auto" });
  const canvas = wrapper.createEl("canvas");
  let chart: Chart | null = null;
  let error: HTMLElement | null = null;
  let destroyed = false;

  const redraw = (): void => {
    if (destroyed) return;
    try {
      // Built before the old chart goes, so a spec that fails to build
      // leaves nothing half drawn
      const { config, height } = build(readTheme(wrapper), wrapper);
      chart?.destroy();
      chart = null;
      error?.remove();
      error = null;
      canvas.show();
      if (height !== undefined) wrapper.setCssProps({ height: `${height}px` });
      chart = new Chart(canvas, config);
    } catch (e) {
      // Chart.js keeps a chart that threw while drawing, and refuses the
      // canvas to the next one until it is destroyed
      Chart.getChart(canvas)?.destroy();
      chart = null;
      canvas.hide();
      wrapper.setCssProps({ height: "" });
      error?.remove();
      error = showError(wrapper, errorText(e));
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

  life.registerEvent(ctx.app.workspace.on("css-change", () => {
    if (ctx.loose) check();
    // A note's chart redraws even while out of view, so it is right when it
    // comes back; the theme is then read from the document
    redraw();
  }));
  life.register(destroy);
  ctx.owner.addChild(life);
  if (ctx.loose) {
    loose.add(check);
    window.setTimeout(check, 0);
  }

  redraw();
  return { redraw, destroy, failed: () => error !== null };
}

export function renderSpec(el: HTMLElement, spec: ChartSpec, ctx: RenderContext): ChartHandle {
  let current = spec;
  const view = mount(el, ctx, (theme, wrapper) => {
    const resolved = resolveSpecColors(current, wrapper);
    return { config: buildConfig(resolved, theme), height: chartHeight(resolved) };
  });
  return {
    update: (next) => {
      current = next;
      view.redraw();
    },
    destroy: () => view.destroy(),
  };
}

/**
 * Draws a raw Chart.js config with theme colours filled in wherever it left
 * them unset. `update` ignores its spec: a raw config has no spec to apply, so
 * it only redraws the same config in the current theme. Returns null when the
 * config fails to draw, with the error shown in its place.
 */
export function renderConfig(el: HTMLElement, config: ChartConfiguration, ctx: RenderContext, width?: string): ChartHandle | null {
  const view = mount(el, ctx, (theme) => ({ config: fillThemeDefaults(config, theme) }), width);
  if (view.failed()) return null;
  return { update: () => view.redraw(), destroy: () => view.destroy() };
}
