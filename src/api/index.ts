import type { Component, Plugin } from "obsidian";
import { drawConfig, registerItems, renderConfig, requireModule, renderSpec, showError, errorText } from "../engine/index.ts";
import type { ChartHandle } from "../engine/index.ts";
import { showHint } from "../engine/hint.ts";
import { shouldInstallRenderChart, shouldRemoveRenderChart } from "./coexist.ts";
import { unwrapRaw } from "./raw.ts";
import { makeRender } from "./render.ts";
import type { RenderHandle } from "./render.ts";
import type { ChartInput } from "./raw.ts";

export interface ChartworkApi {
  version: string;
  /** Gives a CommonJS add-on file Chartwork's own "chart.js" and "chart.js/helpers"; throws for any other name. */
  require(name: string): unknown;
  /** Passes controllers, elements, scales and plugins through to Chart.register. */
  register(...items: Parameters<typeof registerItems>): void;
  /** Takes a Chartwork spec or a Chart.js config; a script can test `version` for the config form. */
  render(el: HTMLElement, input: ChartInput, owner?: Component): RenderHandle;
}

declare global {
  interface Window {
    chartwork?: ChartworkApi;
    renderChart?: (data: unknown, el: HTMLElement) => ChartHandle | null;
  }
}

export function installApi(plugin: Plugin, seriesColors: () => string[]): void {
  // A chart the plugin owns would otherwise stay until the plugin unloads
  const ctx = (owner: Component) => ({ app: plugin.app, owner, seriesColors, loose: owner === plugin });

  const api: ChartworkApi = {
    version: plugin.manifest.version,
    require: requireModule,
    register: (...items) => registerItems(...items),
    render: makeRender({
      spec: (el, spec, owner) => renderSpec(el, spec, ctx(owner)),
      config: (el, config, owner, width) => drawConfig(el, config, ctx(owner), width),
      hint: (el, message) => showHint(el, message),
    }, plugin),
  };
  window.chartwork = api;
  plugin.register(() => {
    if (window.chartwork === api) delete window.chartwork;
  });

  // Charts draws a failed config's error in the note and returns null, so a
  // script written for it never sees an exception
  const renderChart = (data: unknown, el: HTMLElement): ChartHandle | null => {
    let raw;
    try {
      raw = unwrapRaw(data);
    } catch (e) {
      showError(el, errorText(e));
      return null;
    }
    return renderConfig(el, raw.config, ctx(plugin), raw.width);
  };
  if (shouldInstallRenderChart(window.renderChart)) {
    window.renderChart = renderChart;
    plugin.register(() => {
      if (shouldRemoveRenderChart(window.renderChart, renderChart)) delete window.renderChart;
    });
  }
}
