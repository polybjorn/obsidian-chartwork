import { PluginSettingTab, Setting } from "obsidian";
import type ChartworkPlugin from "./main.ts";
import { parseColorList } from "./settings.ts";

export class ChartworkSettingTab extends PluginSettingTab {
  private readonly plugin: ChartworkPlugin;

  constructor(plugin: ChartworkPlugin) {
    super(plugin.app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    this.containerEl.empty();
    new Setting(this.containerEl)
      .setName("Series colors")
      .setDesc("One CSS color per line, used for the first series, then the second, and so on, before the theme's colors. A color set in the chart itself wins. Empty by default.")
      .addTextArea((area) => {
        area
          .setPlaceholder("#4e79a7\nvar(--color-orange)")
          .setValue(this.plugin.settings.seriesColors.join("\n"));
        area.inputEl.rows = 6;
        // On change rather than on input, so charts redraw once per edit
        // instead of once per keystroke
        area.inputEl.addEventListener("change", () => {
          void this.plugin.setSeriesColors(parseColorList(area.getValue()));
        });
      });
  }
}
