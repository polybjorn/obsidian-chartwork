import { Plugin } from "obsidian";
import { installApi } from "./api/index.ts";
import { registerChartView } from "./bases/view.ts";
import { registerChartBlock } from "./codeblock/processor.ts";
import { registerCompat } from "./compat/command.ts";

export default class ChartworkPlugin extends Plugin {
  override onload(): void {
    registerChartView(this);
    installApi(this);
    registerChartBlock(this);
    registerCompat(this);
  }
}
