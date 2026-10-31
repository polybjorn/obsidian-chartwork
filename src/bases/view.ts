import {
  BasesView,
  FileValue,
  ListValue,
  NullValue,
  NumberValue,
  type BasesAllOptions,
  type BasesEntry,
  type BasesPropertyId,
  type BasesViewConfig,
  type Plugin,
  type QueryController,
  type Value,
} from "obsidian";
import { CHART_KINDS, SORTS, errorText, isOneOf, renderSpec, showError, type ChartHandle } from "../engine/index.ts";
import {
  NONE_LABEL,
  aggregateRows,
  parseCategoryColors,
  type Aggregation,
  type Row,
} from "./aggregate.ts";

export const CHART_VIEW_TYPE = "chartwork-chart";

const AGGREGATIONS: Aggregation[] = ["count", "sum", "average"];

function viewOptions(config: BasesViewConfig): BasesAllOptions[] {
  return [
    { type: "property", key: "x", displayName: "Category property", placeholder: "Property" },
    {
      type: "dropdown",
      key: "aggregation",
      displayName: "Aggregation",
      default: "count",
      options: { count: "Count", sum: "Sum", average: "Average" },
    },
    {
      type: "property",
      key: "y",
      displayName: "Value property",
      placeholder: "Property",
      shouldHide: () => (config.get("aggregation") ?? "count") === "count",
    },
    {
      type: "dropdown",
      key: "kind",
      displayName: "Chart type",
      default: "bar",
      options: { bar: "Bar", line: "Line", pie: "Pie", doughnut: "Doughnut" },
    },
    { type: "toggle", key: "horizontal", displayName: "Horizontal bars", default: false },
    { type: "text", key: "title", displayName: "Title" },
    {
      type: "group",
      displayName: "Categories",
      items: [
        {
          type: "dropdown",
          // Bases owns "sort" and "order" (arrays) in every view, and rejects
          // the whole view when a plugin stores a string under them.
          key: "categorySort",
          displayName: "Sort",
          default: "none",
          options: { none: "As found", value: "By value", label: "By label" },
        },
        { type: "slider", key: "topN", displayName: "Largest categories to keep", default: 0, min: 0, max: 50, step: 1 },
        { type: "text", key: "other", displayName: "Label for the rest" },
        { type: "text", key: "categoryOrder", displayName: "Order first", placeholder: "Comma separated labels" },
        { type: "multitext", key: "categoryColors", displayName: "Category colors", default: [] },
        { type: "toggle", key: "skipEmpty", displayName: "Skip empty categories", default: false },
      ],
    },
  ];
}

function plain(value: Value | null): unknown {
  if (value === null || value instanceof NullValue) return null;
  if (value instanceof ListValue) {
    const items: unknown[] = [];
    for (let i = 0; i < value.length(); i++) items.push(plain(value.get(i)));
    return items;
  }
  if (value instanceof NumberValue) return Number(value.toString());
  if (value instanceof FileValue) {
    const base = value.toString().split("/").pop() ?? "";
    return base.replace(/\.md$/, "");
  }
  return value.toString();
}

function text(config: BasesViewConfig, key: string): string {
  const value = config.get(key);
  return typeof value === "string" ? value.trim() : "";
}

class ChartView extends BasesView {
  type = CHART_VIEW_TYPE;
  private readonly host: HTMLElement;
  private handle: ChartHandle | null = null;

  constructor(controller: QueryController, containerEl: HTMLElement) {
    super(controller);
    this.host = containerEl.createDiv({ cls: "chartwork-bases" });
  }

  onDataUpdated(): void {
    try {
      this.draw();
    } catch (e) {
      this.clear();
      showError(this.host, errorText(e));
    }
  }

  private draw(): void {
    const x = this.config.getAsPropertyId("x");
    if (!x) return this.showMessage("Choose a category property in the view options.");

    const aggregationValue = this.config.get("aggregation");
    const aggregation = AGGREGATIONS.find((a) => a === aggregationValue) ?? "count";
    const y = aggregation === "count" ? null : this.config.getAsPropertyId("y");
    if (aggregation !== "count" && !y) {
      return this.showMessage("Choose a value property in the view options.");
    }

    const groups = this.data.groupedData;
    const grouped = groups.length > 1 || groups.some((g) => g.hasKey());
    const rows: Row[] = [];
    for (const group of groups) {
      const name = grouped ? (group.hasKey() ? group.key?.toString() ?? "" : NONE_LABEL) : undefined;
      for (const entry of group.entries) rows.push(this.row(entry, x, y, name));
    }

    const kindValue = this.config.get("kind");
    const sortValue = this.config.get("categorySort");
    const topN = Number(this.config.get("topN"));
    const spec = aggregateRows(rows, {
      aggregation,
      kind: isOneOf(CHART_KINDS, kindValue) ? kindValue : "bar",
      horizontal: this.config.get("horizontal") === true,
      title: text(this.config, "title") || undefined,
      sort: isOneOf(SORTS, sortValue) ? sortValue : "none",
      topN: Number.isFinite(topN) ? topN : 0,
      other: text(this.config, "other") || undefined,
      order: text(this.config, "categoryOrder").split(",").map((s) => s.trim()).filter(Boolean),
      categoryColors: parseCategoryColors(this.config.get("categoryColors")),
      skipEmpty: this.config.get("skipEmpty") === true,
      seriesName: y ? this.config.getDisplayName(y) : undefined,
      valueTitle: y ? this.config.getDisplayName(y) : undefined,
    });

    if (this.handle) {
      this.handle.update(spec);
      return;
    }
    this.host.empty();
    this.handle = renderSpec(this.host, spec, { app: this.app, owner: this });
  }

  private row(entry: BasesEntry, x: BasesPropertyId, y: BasesPropertyId | null, group?: string): Row {
    return { x: plain(entry.getValue(x)), y: y ? plain(entry.getValue(y)) : undefined, group };
  }

  private clear(): void {
    this.handle?.destroy();
    this.handle = null;
    this.host.empty();
  }

  private showMessage(message: string): void {
    this.clear();
    this.host.createEl("p", { text: message, cls: "chartwork-empty" });
  }
}

export function registerChartView(plugin: Plugin): void {
  plugin.registerBasesView(CHART_VIEW_TYPE, {
    name: "Chart",
    icon: "lucide-chart-column",
    factory: (controller, containerEl) => new ChartView(controller, containerEl),
    options: viewOptions,
  });
}
