import { MarkdownRenderChild, parseYaml } from "obsidian";
import type { MarkdownPostProcessorContext, Plugin } from "obsidian";
import { renderSpec, showError } from "../engine/index.ts";
import { parseChartBlock } from "./parse.ts";

interface PluginsHost {
  plugins?: { enabledPlugins?: Set<string> };
}

// Two processors on one language would both draw into the same block, and
// app.plugins is not public API, so a missing field means "not detected".
export function chartsEnabled(plugin: Plugin): boolean {
  const host = plugin.app as unknown as PluginsHost;
  return host.plugins?.enabledPlugins?.has("obsidian-charts") === true;
}

export function registerChartBlock(plugin: Plugin): void {
  if (chartsEnabled(plugin)) return;

  plugin.registerMarkdownCodeBlockProcessor("chart", (source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
    let data: unknown;
    try {
      data = parseYaml(source);
    } catch (e) {
      showError(el, `The block is not valid YAML. ${e instanceof Error ? e.message : ""}`.trim());
      return;
    }
    const result = parseChartBlock(data);
    if (!result.ok) {
      showError(el, result.error);
      return;
    }
    const owner = new MarkdownRenderChild(el);
    ctx.addChild(owner);
    const host = el.createDiv({ cls: "chartwork-block" });
    if (result.value.width) host.setCssProps({ width: result.value.width });
    try {
      renderSpec(host, result.value.spec, { app: plugin.app, owner });
    } catch (e) {
      host.remove();
      showError(el, e instanceof Error ? e.message : "The chart failed to render.");
    }
  });
}
