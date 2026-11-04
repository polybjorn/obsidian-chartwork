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
import { CHART_KINDS, DATE_UNITS, DEFAULT_TENSION, SORTS, errorText, isOneOf, renderSpec, showError, type ChartHandle, type ChartSpec } from "../engine/index.ts";
import {
  AGGREGATIONS,
  NONE_LABEL,
  aggregateRows,
  parseCategoryColors,
  parseNumber,
  propertyRows,
  scatterSpec,
  type Row,
  type ScatterEntry,
} from "./aggregate.ts";

export const CHART_VIEW_TYPE = "chartwork-chart";

// Bounds and the mean line have no meaning on a pie, and a scatter plots each
// note as it is
const noValueAxis = (config: BasesViewConfig): boolean => ["pie", "doughnut", "scatter"].includes(text(config, "kind"));

function viewOptions(config: BasesViewConfig): BasesAllOptions[] {
  const scatter = (): boolean => config.get("kind") === "scatter";
  return [
    { type: "property", key: "x", displayName: "Category property (x for scatter)", placeholder: "Property" },
    {
      type: "dropdown",
      key: "aggregation",
      displayName: "Aggregation",
      default: "count",
      shouldHide: scatter,
      options: { count: "Count", sum: "Sum", average: "Average", min: "Minimum", max: "Maximum" },
    },
    {
      type: "property",
      key: "y",
      displayName: "Value property (y for scatter)",
      placeholder: "Property",
      shouldHide: () => !scatter() && ((config.get("aggregation") ?? "count") === "count" || config.get("propertySeries") === true),
    },
    { type: "property", key: "size", displayName: "Point size property", placeholder: "Property", shouldHide: () => !scatter() },
    { type: "toggle", key: "propertySeries", displayName: "One series per property", default: false, shouldHide: scatter },
    {
      type: "dropdown",
      key: "kind",
      displayName: "Chart type",
      default: "bar",
      options: { bar: "Bar", line: "Line", pie: "Pie", doughnut: "Doughnut", scatter: "Scatter" },
    },
    {
      type: "dropdown",
      key: "dateUnit",
      displayName: "Group dates by",
      default: "day",
      options: { day: "Day", week: "Week", month: "Month", year: "Year" },
      shouldHide: scatter,
    },
    { type: "toggle", key: "horizontal", displayName: "Horizontal bars", default: false, shouldHide: scatter },
    { type: "toggle", key: "cumulative", displayName: "Running total", default: false, shouldHide: scatter },
    { type: "text", key: "title", displayName: "Title" },
    {
      type: "group",
      displayName: "Value axis",
      shouldHide: () => noValueAxis(config),
      items: [
        // Text rather than a slider, so an empty field means no bound
        { type: "text", key: "yMin", displayName: "Minimum", placeholder: "Automatic" },
        { type: "text", key: "yMax", displayName: "Maximum", placeholder: "Automatic" },
        { type: "toggle", key: "beginAtZero", displayName: "Start at zero", default: true },
        { type: "toggle", key: "average", displayName: "Average line", default: false },
        {
          type: "slider",
          key: "tension",
          displayName: "Line smoothing",
          default: DEFAULT_TENSION,
          min: 0,
          max: 1,
          step: 0.05,
          shouldHide: () => config.get("kind") !== "line",
        },
      ],
    },
    {
      type: "group",
      displayName: "Categories",
      shouldHide: scatter,
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

function bound(config: BasesViewConfig, key: string): number | undefined {
  return parseNumber(text(config, key)) ?? undefined;
}

class ChartView extends BasesView {
  type = CHART_VIEW_TYPE;
  private readonly host: HTMLElement;
  private readonly seriesColors: () => string[];
  private handle: ChartHandle | null = null;

  constructor(controller: QueryController, containerEl: HTMLElement, seriesColors: () => string[]) {
    super(controller);
    this.seriesColors = seriesColors;
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
    if (this.config.get("kind") === "scatter") return this.drawScatter(x);
    if (!x) return this.showMessage("Choose a category property in the view options.");

    const aggregationValue = this.config.get("aggregation");
    const aggregation = isOneOf(AGGREGATIONS, aggregationValue) ? aggregationValue : "count";
    const properties = this.config.get("propertySeries") === true ? this.seriesProperties(x) : null;
    if (properties?.length === 0) {
      return this.showMessage("Choose the properties to chart in the Properties menu.");
    }
    const y = aggregation === "count" || properties ? null : this.config.getAsPropertyId("y");
    if (aggregation !== "count" && !properties && !y) {
      return this.showMessage("Choose a value property in the view options.");
    }

    const groups = this.data.groupedData;
    const grouped = groups.length > 1 || groups.some((g) => g.hasKey());
    const rows: Row[] = [];
    const seriesOrder: string[] = [];
    for (const group of groups) {
      const name = grouped ? (group.hasKey() ? group.key?.toString() ?? "" : NONE_LABEL) : undefined;
      if (!properties) {
        for (const entry of group.entries) rows.push(this.row(entry, x, y, name));
        continue;
      }
      const names = properties.map((p) => this.config.getDisplayName(p));
      seriesOrder.push(...names.map((n) => (name ? `${name}: ${n}` : n)));
      for (const entry of group.entries) {
        const values = properties.map((p) => plain(entry.getValue(p)));
        rows.push(...propertyRows(plain(entry.getValue(x)), values, names, name, aggregation === "count"));
      }
    }

    const kindValue = this.config.get("kind");
    const unitValue = this.config.get("dateUnit");
    const sortValue = this.config.get("categorySort");
    const topN = Number(this.config.get("topN"));
    const tension = this.config.get("tension");
    const spec = aggregateRows(rows, {
      min: bound(this.config, "yMin"),
      max: bound(this.config, "yMax"),
      beginAtZero: this.config.get("beginAtZero") === false ? false : undefined,
      average: this.config.get("average") === true,
      // Left at the default, the line keeps the default curve, which cannot overshoot
      tension: typeof tension === "number" && tension !== DEFAULT_TENSION ? tension : undefined,
      aggregation,
      kind: isOneOf(CHART_KINDS, kindValue) ? kindValue : "bar",
      horizontal: this.config.get("horizontal") === true,
      cumulative: this.config.get("cumulative") === true,
      title: text(this.config, "title") || undefined,
      sort: isOneOf(SORTS, sortValue) ? sortValue : "none",
      topN: Number.isFinite(topN) ? topN : 0,
      other: text(this.config, "other") || undefined,
      order: text(this.config, "categoryOrder").split(",").map((s) => s.trim()).filter(Boolean),
      categoryColors: parseCategoryColors(this.config.get("categoryColors")),
      skipEmpty: this.config.get("skipEmpty") === true,
      dateUnit: isOneOf(DATE_UNITS, unitValue) ? unitValue : "day",
      seriesName: y ? this.config.getDisplayName(y) : undefined,
      seriesOrder: properties ? seriesOrder : undefined,
      valueTitle: y ? this.config.getDisplayName(y) : undefined,
    });

    this.show(spec);
  }

  private drawScatter(x: BasesPropertyId | null): void {
    const y = this.config.getAsPropertyId("y");
    if (!x || !y) return this.showMessage("Choose an x and a y property in the view options.");
    const size = this.config.getAsPropertyId("size");

    const groups = this.data.groupedData;
    const grouped = groups.length > 1 || groups.some((g) => g.hasKey());
    const entries: ScatterEntry[] = [];
    for (const group of groups) {
      const name = grouped ? (group.hasKey() ? group.key?.toString() ?? "" : NONE_LABEL) : undefined;
      for (const entry of group.entries) {
        entries.push({
          name: entry.file.basename,
          x: plain(entry.getValue(x)),
          y: plain(entry.getValue(y)),
          size: size ? plain(entry.getValue(size)) : undefined,
          group: name,
        });
      }
    }
    const spec = scatterSpec(entries, {
      title: text(this.config, "title") || undefined,
      xTitle: this.config.getDisplayName(x),
      yTitle: this.config.getDisplayName(y),
      sizeTitle: size ? this.config.getDisplayName(size) : undefined,
      sized: size !== null,
    });
    if (spec.series.every((s) => (s.points?.length ?? 0) === 0)) {
      return this.showMessage("No notes have a number in both the x and y properties.");
    }
    this.show(spec);
  }

  private show(spec: ChartSpec): void {
    if (this.handle) {
      this.handle.update(spec);
      return;
    }
    this.host.empty();
    this.handle = renderSpec(this.host, spec, { app: this.app, owner: this, seriesColors: this.seriesColors });
  }

  // The file name is in a new view's property list by default, and is never a number
  private seriesProperties(x: BasesPropertyId): BasesPropertyId[] {
    return this.config.getOrder().filter((p) => p !== x && p !== "file.name");
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

export function registerChartView(plugin: Plugin, seriesColors: () => string[]): void {
  plugin.registerBasesView(CHART_VIEW_TYPE, {
    name: "Chart",
    icon: "lucide-chart-column",
    factory: (controller, containerEl) => new ChartView(controller, containerEl, seriesColors),
    options: viewOptions,
  });
}
