import { MarkdownRenderChild, parseYaml } from "obsidian";
import type { MarkdownPostProcessorContext, Plugin } from "obsidian";
import { chartsEnabled } from "../compat/charts.ts";
import { renderConfig, renderSpec, showError } from "../engine/index.ts";
import { showHint } from "../engine/hint.ts";
import type { ChartHandle, ChartSpec } from "../engine/index.ts";
import { blockHint } from "./hints.ts";
import { parseChartBlock, seriesFill, yamlError } from "./parse.ts";
import type { ParsedBlock, TableRef } from "./parse.ts";
import { findCsv, findTable } from "./table-source.ts";
import { tableToSeries } from "./table.ts";

/**
 * Draws a block whose numbers sit in a table, and redraws it whenever the
 * note holding the table changes. An error replaces the chart in place and
 * the next good read brings the chart back.
 */
function renderTableBlock(
  plugin: Plugin,
  el: HTMLElement,
  block: ParsedBlock & { table: TableRef },
  ctx: MarkdownPostProcessorContext,
  seriesColors: () => string[],
  hint: string | undefined,
): void {
  const { table: ref } = block;
  const owner = new MarkdownRenderChild(el);
  ctx.addChild(owner);
  const app = plugin.app;
  let handle: ChartHandle | null = null;
  let host: HTMLElement | null = null;
  let error: HTMLElement | null = null;
  const hintEl = hint ? showHint(el, hint) : null;
  let tablePath = "csv" in ref || ref.file ? "" : ctx.sourcePath;
  // Reads finish out of order when edits come fast; only the latest draws
  let latest = 0;

  const clear = (): void => {
    handle?.destroy();
    handle = null;
    host?.remove();
    host = null;
    error?.remove();
    error = null;
  };
  const fail = (message: string): void => {
    clear();
    error = showError(el, message);
  };

  const draw = async (): Promise<void> => {
    const run = ++latest;
    const found = "csv" in ref
      ? await findCsv(app, ref.csv, ctx.sourcePath)
      : await findTable(app, ref.id, ref.file, ctx.sourcePath);
    if (run !== latest) return;
    if (!found.ok) return fail(found.error);
    tablePath = found.value.path;
    const data = tableToSeries(found.value.table, ref.layout, ref.select);
    if (!data.ok) return fail(data.error);
    const fill = seriesFill(block.spec.kind, ref.fill);
    const series = fill === undefined ? data.series : data.series.map((s) => ({ ...s, fill }));
    const spec: ChartSpec = { ...block.spec, labels: data.labels, series };
    if (handle) {
      handle.update(spec);
      return;
    }
    clear();
    host = el.createDiv({ cls: "chartwork-block" });
    if (block.width) host.setCssProps({ "--chartwork-block-width": block.width });
    // The chart is made anew after an error, so the hint moves back under it
    if (hintEl) el.appendChild(hintEl);
    try {
      handle = renderSpec(host, spec, { app, owner, seriesColors });
    } catch (e) {
      fail(e instanceof Error ? e.message : "The chart failed to render.");
    }
  };

  owner.registerEvent(app.metadataCache.on("changed", (file) => {
    if (file.path === tablePath) void draw();
  }));
  // The metadata cache skips files that are not notes, so a CSV is watched in the vault
  if ("csv" in ref) {
    owner.registerEvent(app.vault.on("modify", (file) => {
      if (file.path === tablePath) void draw();
    }));
    const retry = (): void => {
      if (error) void draw();
    };
    owner.registerEvent(app.vault.on("create", retry));
    owner.registerEvent(app.vault.on("rename", retry));
  }
  // The cache may not know the note yet when Obsidian has just started
  owner.registerEvent(app.metadataCache.on("resolved", () => {
    if (error) void draw();
  }));
  void draw();
}

export function registerChartBlock(plugin: Plugin, seriesColors: () => string[]): void {
  if (chartsEnabled(plugin)) return;

  plugin.registerMarkdownCodeBlockProcessor("chart", (source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
    let data: unknown;
    try {
      data = parseYaml(source);
    } catch (e) {
      showError(el, yamlError(e));
      return;
    }
    const result = parseChartBlock(data);
    if (!result.ok) {
      showError(el, result.error);
      return;
    }
    const hint = blockHint(data as Record<string, unknown>);
    if ("table" in result.value && result.value.table) {
      renderTableBlock(plugin, el, { ...result.value, table: result.value.table }, ctx, seriesColors, hint);
      return;
    }
    const owner = new MarkdownRenderChild(el);
    ctx.addChild(owner);
    const host = el.createDiv({ cls: "chartwork-block" });
    if (result.value.width) host.setCssProps({ "--chartwork-block-width": result.value.width });
    try {
      const value = result.value;
      if ("config" in value) renderConfig(host, value.config, { app: plugin.app, owner, seriesColors });
      else renderSpec(host, value.spec, { app: plugin.app, owner, seriesColors });
    } catch (e) {
      host.remove();
      showError(el, e instanceof Error ? e.message : "The chart failed to render.");
    }
    if (hint) showHint(el, hint);
  });
}
