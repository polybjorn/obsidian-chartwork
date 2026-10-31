import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  DoughnutController,
  Filler,
  Legend,
  LineController,
  LineElement,
  LinearScale,
  PieController,
  PointElement,
  Title,
  Tooltip,
} from "chart.js";
import type { ChartConfiguration } from "chart.js";
import { buildConfig, chartHeight, fillThemeDefaults } from "./config.ts";
import type { ChartHandle, ChartSpec, RenderContext } from "./spec.ts";
import { readTheme, resolveSpecColors } from "./theme.ts";
import type { Theme } from "./theme.ts";

let registered = false;
function registerOnce(): void {
  if (registered) return;
  registered = true;
  Chart.register(
    BarController, LineController, PieController, DoughnutController,
    BarElement, LineElement, PointElement, ArcElement,
    CategoryScale, LinearScale,
    Legend, Title, Tooltip, Filler,
  );
}

interface Built {
  config: ChartConfiguration;
  /** Pixels; absent when the caller's own config sizes the chart. */
  height?: number;
}

type Build = (theme: Theme, wrapper: HTMLElement) => Built;

function mount(el: HTMLElement, ctx: RenderContext, build: Build): { redraw: () => void; destroy: () => void } {
  registerOnce();
  const wrapper = el.createDiv({ cls: "chartwork-chart" });
  const canvas = wrapper.createEl("canvas");
  let chart: Chart | null = null;
  let destroyed = false;

  const redraw = (): void => {
    if (destroyed) return;
    chart?.destroy();
    const { config, height } = build(readTheme(wrapper), wrapper);
    wrapper.setCssProps({
      position: "relative",
      width: "100%",
      ...(height !== undefined ? { height: `${height}px` } : {}),
    });
    chart = new Chart(canvas, config);
  };

  const destroy = (): void => {
    if (destroyed) return;
    destroyed = true;
    ctx.app.workspace.offref(ref);
    chart?.destroy();
    chart = null;
    wrapper.remove();
  };

  // A long-lived owner (the plugin) never unloads, so a chart whose note was
  // closed has to notice its canvas is gone and clean up here. Code blocks and
  // Bases views draw before their element is attached, so only a chart that
  // has been on screen counts as closed.
  let shown = false;
  const ref = ctx.app.workspace.on("css-change", () => {
    if (canvas.isConnected) {
      shown = true;
      redraw();
    } else if (shown) {
      destroy();
    }
  });
  ctx.owner.registerEvent(ref);
  ctx.owner.register(destroy);

  redraw();
  shown = canvas.isConnected;
  return { redraw, destroy };
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
 * it only redraws the same config in the current theme.
 */
export function renderConfig(el: HTMLElement, config: ChartConfiguration, ctx: RenderContext): ChartHandle {
  const view = mount(el, ctx, (theme) => ({ config: fillThemeDefaults(config, theme) }));
  return { update: () => view.redraw(), destroy: () => view.destroy() };
}
