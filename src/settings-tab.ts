import { PluginSettingTab, Setting } from "obsidian";
import type { SettingDefinitionItem } from "obsidian";
import type ChartworkPlugin from "./main.ts";
import { parseColorList } from "./settings.ts";

interface Row {
  name: string;
  desc: string;
  /** More words settings search finds the row by. */
  aliases: string[];
  render: (setting: Setting) => void;
}

export class ChartworkSettingTab extends PluginSettingTab {
  private readonly plugin: ChartworkPlugin;
  private readonly check: () => Promise<void>;

  constructor(plugin: ChartworkPlugin, check: () => Promise<void>) {
    super(plugin.app, plugin);
    this.plugin = plugin;
    this.check = check;
  }

  private rows(): Row[] {
    return [
      {
        name: "Series colors",
        desc: "One CSS color per line, used for the first series, then the second, and so on, before the theme's colors. A color set in the chart itself wins. Empty by default.",
        aliases: ["palette", "chart colors"],
        render: (setting) => {
          setting.addTextArea((area) => {
            area
              .setPlaceholder("#4e79a7\nvar(--color-orange)")
              .setValue(this.plugin.settings.seriesColors.join("\n"));
            area.inputEl.rows = 6;
            // On change rather than on input, so charts redraw once per edit
            // instead of once per keystroke. Obsidian's own textarea control
            // saves on input, which is why this row renders its own
            area.inputEl.addEventListener("change", () => {
              void this.plugin.setSeriesColors(parseColorList(area.getValue()));
            });
          });
        },
      },
      {
        name: "Check chart blocks and scripts",
        desc: "Lists every chart block in the vault that Chartwork can't draw or draws only in part, and every script still calling renderChart from the Charts plugin.",
        aliases: ["renderChart", "migrate", "Charts plugin"],
        render: (setting) => {
          setting.addButton((button) => button
            .setButtonText("Check")
            .onClick(() => void this.check()));
        },
      },
    ];
  }

  // Obsidian 1.13 and later draws the tab from these and indexes them for
  // settings search
  override getSettingDefinitions(): SettingDefinitionItem[] {
    return this.rows().map(({ name, desc, aliases, render }) => ({ name, desc, aliases, render }));
  }

  // Only Obsidian before 1.13, which minAppVersion still allows, calls this
  display(): void {
    this.containerEl.empty();
    for (const row of this.rows()) row.render(new Setting(this.containerEl).setName(row.name).setDesc(row.desc));
  }
}
