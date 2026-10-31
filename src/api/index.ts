import type { Component, Plugin } from "obsidian";
import type { ChartConfiguration } from "chart.js";
import { renderConfig, renderSpec } from "../engine/index.ts";
import type { ChartHandle, ChartSpec } from "../engine/index.ts";
import { shouldInstallRenderChart, shouldRemoveRenderChart } from "./coexist.ts";
import { validateSpec } from "./validate.ts";

export interface ChartworkApi {
  version: string;
  render(el: HTMLElement, spec: ChartSpec, owner?: Component): ChartHandle;
}

declare global {
  interface Window {
    chartwork?: ChartworkApi;
    renderChart?: (config: ChartConfiguration, el: HTMLElement) => ChartHandle;
  }
}

export function installApi(plugin: Plugin): void {
  const ctx = (owner: Component) => ({ app: plugin.app, owner });

  const api: ChartworkApi = {
    version: plugin.manifest.version,
    render: (el, spec, owner = plugin) => renderSpec(el, validateSpec(spec), ctx(owner)),
  };
  window.chartwork = api;
  plugin.register(() => {
    if (window.chartwork === api) delete window.chartwork;
  });

  const renderChart = (config: ChartConfiguration, el: HTMLElement): ChartHandle =>
    renderConfig(el, config, ctx(plugin));
  if (shouldInstallRenderChart(window.renderChart)) {
    window.renderChart = renderChart;
    plugin.register(() => {
      if (shouldRemoveRenderChart(window.renderChart, renderChart)) delete window.renderChart;
    });
  }
}
