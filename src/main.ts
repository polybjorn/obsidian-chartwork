import { Plugin } from "obsidian";
import { installApi } from "./api/index.ts";
import { registerChartView } from "./bases/view.ts";
import { registerChartBlock } from "./codeblock/processor.ts";
import { registerCompat } from "./compat/command.ts";
import { chartworkEvents, SERIES_COLORS_CHANGED } from "./engine/render.ts";
import { readSettings } from "./settings.ts";
import type { ChartworkSettings } from "./settings.ts";
import { ChartworkSettingTab } from "./settings-tab.ts";

export default class ChartworkPlugin extends Plugin {
  settings: ChartworkSettings = { seriesColors: [] };

  override async onload(): Promise<void> {
    this.settings = readSettings(await this.loadData());
    const colors = (): string[] => this.settings.seriesColors;
    registerChartView(this, colors);
    installApi(this, colors);
    registerChartBlock(this, colors);
    registerCompat(this);
    this.addSettingTab(new ChartworkSettingTab(this));
  }

  async setSeriesColors(seriesColors: string[]): Promise<void> {
    this.settings = { ...this.settings, seriesColors };
    await this.saveData(this.settings);
    chartworkEvents.trigger(SERIES_COLORS_CHANGED);
  }
}
