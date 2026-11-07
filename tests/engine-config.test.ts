import { test } from "node:test";
import assert from "node:assert/strict";
import { prepareData } from "../src/engine/data.ts";
import { bestFitValues, buildConfig, chartHeight, fadeHiddenEntries, fillThemeDefaults, barSide, withAlpha, wrapTitle } from "../src/engine/config.ts";
import type { Theme } from "../src/engine/theme.ts";
import { parseVarRef, resolveConfigColors } from "../src/engine/theme.ts";
import type { ChartSpec } from "../src/engine/spec.ts";
import { BarElement } from "chart.js";
import type { ChartConfiguration } from "chart.js";

const theme: Theme = {
  text: "#111",
  grid: "#ddd",
  background: "#fff",
  font: "Inter",
  fontSize: 20,
  palette: ["#p1", "#p2", "#p3"],
};

const spec: ChartSpec = { kind: "bar", labels: ["a", "b"], series: [{ name: "n", values: [2, 4] }] };

// Walks a dotted path through loosely shaped Chart.js options.
function at(root: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((o, k) => (o === undefined || o === null ? undefined : (o as Record<string, unknown>)[k]), root);
}

function opts(spec: ChartSpec): unknown {
  return buildConfig(spec, theme).options;
}

void test("horizontal bars use the y index axis and hide the category grid", () => {
  const o = opts({ ...spec, horizontal: true });
  assert.equal(at(o, "indexAxis"), "y");
  assert.deepEqual(at(o, "scales.y.grid"), { display: false });
  assert.equal(at(o, "scales.x.grid.color"), "#ddd");
});

void test("integer data sets precision 0 on the value axis, fractions do not", () => {
  assert.equal(at(opts(spec), "scales.y.ticks.precision"), 0);
  const frac = opts({ ...spec, series: [{ name: "n", values: [1.5, 2] }] });
  assert.equal(at(frac, "scales.y.ticks.precision"), undefined);
});

void test("value labels default on for a single-series bar only", () => {
  assert.equal(buildConfig(spec, theme).plugins?.length, 1);
  const two = { ...spec, series: [...spec.series, { name: "m", values: [1, 2] }] };
  assert.equal(buildConfig(two, theme).plugins?.length, 0);
  assert.equal(buildConfig({ ...spec, kind: "line" }, theme).plugins?.length, 0);
  assert.equal(buildConfig({ ...spec, valueLabels: false }, theme).plugins?.length, 0);
  assert.equal(buildConfig({ ...two, valueLabels: true }, theme).plugins?.length, 1);
  for (const kind of ["line", "pie", "doughnut", "polarArea"] as const) {
    assert.equal(buildConfig({ ...spec, kind }, theme).plugins?.length, 0, kind);
    assert.equal(buildConfig({ ...spec, kind, valueLabels: true }, theme).plugins?.length, 1, kind);
  }
  assert.equal(buildConfig({ ...spec, kind: "radar", valueLabels: true }, theme).plugins?.length, 0);
  // Slice labels sit inside the chart, so they take no padding
  assert.equal(at(opts({ ...spec, kind: "pie", valueLabels: true }), "layout.padding"), undefined);
  assert.deepEqual(at(opts({ ...spec, kind: "line", valueLabels: true }), "layout.padding"), { top: 25 });
});

void test("a radar draws one translucent shape per series on a themed radial scale", () => {
  const two: ChartSpec = { kind: "radar", labels: ["a", "b", "c"], series: [{ name: "n", values: [1, 2, 3] }, { name: "m", values: [3, 2, 1], fill: false }] };
  const config = buildConfig(two, theme);
  const ds = config.data.datasets as unknown as { borderColor: string; backgroundColor: string; fill: boolean }[];
  assert.equal(config.type, "radar");
  assert.deepEqual(ds.map((d) => d.borderColor), ["#p1", "#p2"]);
  assert.equal(ds[0]?.backgroundColor, withAlpha("#p1", 0.25));
  assert.deepEqual(ds.map((d) => d.fill), [true, false]);
  assert.equal(ds[1]?.backgroundColor, "#p2");
  const o = config.options;
  assert.equal(at(o, "scales.r.grid.color"), "#ddd");
  assert.equal(at(o, "scales.r.angleLines.color"), "#ddd");
  assert.equal(at(o, "scales.r.pointLabels.color"), "#111");
  assert.equal(at(o, "scales.r.ticks.backdropColor"), "#fff");
  assert.equal(at(o, "scales.r.ticks.precision"), 0);
  assert.equal(at(o, "scales.r.beginAtZero"), true);
  assert.equal(at(o, "scales.x"), undefined);
  assert.equal(at(o, "plugins.legend.display"), true);
});

void test("a polar area colours each segment by category on a themed radial scale", () => {
  const polar: ChartSpec = { kind: "polarArea", labels: ["a", "b"], series: [{ name: "n", values: [3, 5] }], categoryColors: { b: "#c0ffee" } };
  const config = buildConfig(polar, theme);
  const ds = config.data.datasets as unknown as { backgroundColor: string[]; borderColor: string }[];
  assert.equal(config.type, "polarArea");
  assert.deepEqual(ds[0]?.backgroundColor, ["#p1", "#c0ffee"]);
  assert.equal(ds[0]?.borderColor, "#fff");
  const o = config.options;
  assert.equal(at(o, "scales.r.grid.color"), "#ddd");
  assert.equal(at(o, "scales.r.pointLabels.color"), "#111");
  assert.equal(at(o, "scales.r.ticks.backdropColor"), "#fff");
  assert.equal(at(o, "plugins.legend.display"), true);
});

void test("legend is hidden for one series and shown for several or for pie", () => {
  assert.equal(at(opts(spec), "plugins.legend.display"), false);
  const two = { ...spec, series: [...spec.series, { name: "m", values: [1, 2] }] };
  assert.equal(at(opts(two), "plugins.legend.display"), true);
  assert.equal(at(opts({ ...spec, kind: "pie" }), "plugins.legend.display"), true);
});

void test("series default to the palette in order", () => {
  const two: ChartSpec = { ...spec, series: [...spec.series, { name: "m", values: [1, 2] }] };
  const ds = buildConfig(two, theme).data.datasets as { backgroundColor: string }[];
  assert.deepEqual(ds.map((d) => d.backgroundColor), ["#p1", "#p2"]);
});

void test("categoryColors follow labels after sorting and fall back to the palette", () => {
  const out = buildConfig(
    { ...spec, labels: ["a", "b", "c"], series: [{ name: "n", values: [1, 5, 3] }], sort: "value", categoryColors: { b: "teal" } },
    theme,
  );
  const ds = out.data.datasets[0] as unknown as { backgroundColor: string[] };
  assert.deepEqual(out.data.labels, ["b", "c", "a"]);
  assert.deepEqual(ds.backgroundColor, ["teal", "#p2", "#p3"]);
});

void test("theme text colour reaches axes, legend and title", () => {
  const o = opts({ ...spec, title: "T", valueTitle: "Count", horizontal: true });
  assert.equal(at(o, "scales.x.ticks.color"), "#111");
  assert.equal(at(o, "scales.x.title.text"), "Count");
  assert.equal(at(o, "plugins.title.color"), "#111");
  assert.equal(at(o, "plugins.legend.labels.color"), "#111");
  assert.equal(at(o, "plugins.legend.labels.boxWidth"), 14);
});

void test("horizontal height scales with bar count", () => {
  const h = (n: number): number =>
    chartHeight({ ...spec, horizontal: true, labels: Array.from({ length: n }, String), series: [{ name: "n", values: Array<number>(n).fill(1) }] });
  assert.equal(h(10) - h(5), 5 * 28);
  assert.equal(chartHeight({ ...spec, horizontal: true, barThickness: 40 }), 2 * 40 + 56);
  assert.equal(chartHeight({ ...spec, horizontal: true, height: 500 }), 500);
  assert.equal(chartHeight({ ...spec, height: 180 }), 180);
  assert.equal(chartHeight(spec), 300);
});

void test("horizontal height gives each unstacked series a bar and the legend its row", () => {
  const three: ChartSpec = {
    ...spec,
    horizontal: true,
    series: [{ name: "a", values: [1, 2] }, { name: "b", values: [3, 4] }, { name: "c", values: [5, 6] }],
  };
  assert.equal(chartHeight(three), 2 * 3 * 28 + 56 + 32);
  assert.equal(chartHeight({ ...three, stacked: true }), 2 * 28 + 56 + 32);
  assert.equal(chartHeight({ ...three, legend: false }), 2 * 3 * 28 + 56);
  assert.equal(chartHeight({ ...three, legend: "right" }), 2 * 3 * 28 + 56);
  assert.equal(chartHeight({ ...spec, horizontal: true, legend: "bottom" }), 2 * 28 + 56 + 32);
});

void test("theme fill keeps what the caller set and does not mutate the input", () => {
  const config = {
    type: "bar",
    data: { labels: ["a"], datasets: [{ data: [1] }, { data: [2], backgroundColor: "hotpink" }] },
    options: {
      color: "orange",
      scales: { y: { ticks: { color: "lime" }, grid: {} } },
      plugins: { legend: { labels: { boxWidth: 30 } } },
    },
  } as unknown as ChartConfiguration;
  const before = JSON.stringify(config);
  const out = fillThemeDefaults(config, theme);
  const o = out.options;
  const ds = out.data.datasets as unknown as { backgroundColor: string }[];

  assert.equal(JSON.stringify(config), before);
  assert.equal(at(o, "color"), "orange");
  assert.equal(at(o, "scales.y.ticks.color"), "lime");
  assert.equal(at(o, "scales.y.grid.color"), "#ddd");
  assert.equal(at(o, "scales.x.ticks.color"), "#111");
  assert.equal(at(o, "plugins.title.color"), "#111");
  assert.equal(at(o, "plugins.legend.labels.boxWidth"), 30);
  assert.equal(at(o, "plugins.legend.labels.boxHeight"), 14);
  assert.deepEqual(ds.map((d) => d.backgroundColor), ["#p1", "hotpink"]);
});

void test("theme fill reaches radial scales and colours each chart type", () => {
  const raw = (type: string) =>
    fillThemeDefaults({ type, data: { labels: ["a", "b"], datasets: [{ data: [1, 2] }] } } as unknown as ChartConfiguration, theme);
  const radar = raw("radar");
  assert.equal(at(radar.options, "scales.r.ticks.color"), "#111");
  assert.equal(at(radar.options, "scales.r.ticks.backdropColor"), "#fff");
  assert.equal(at(radar.options, "scales.r.angleLines.color"), "#ddd");
  assert.equal(at(radar.options, "scales.r.pointLabels.color"), "#111");
  assert.equal(at(radar.options, "scales.x"), undefined);
  assert.equal(at(radar, "data.datasets.0.borderColor"), "#p1");
  assert.deepEqual(at(raw("polarArea"), "data.datasets.0.backgroundColor"), ["#p1", "#p2"]);
  assert.equal(at(raw("polarArea").options, "scales.r.grid.color"), "#ddd");
  assert.equal(at(raw("scatter").options, "scales.x.grid.color"), "#ddd");
  assert.equal(at(raw("scatter"), "data.datasets.0.backgroundColor"), "#p1");
  assert.equal(at(raw("line"), "data.datasets.0.borderColor"), "#p1");
  assert.equal(at(raw("bar"), "data.datasets.0.borderColor"), undefined);
});

void test("fillThemeDefaults colors each dataset of a mixed chart by its own type", () => {
  const out = fillThemeDefaults({
    type: "bar",
    data: { labels: ["a", "b"], datasets: [{ data: [1, 2] }, { type: "line", data: [2, 1] }, { type: "bubble", data: [] }] },
  } as unknown as ChartConfiguration, theme);
  assert.equal(at(out, "data.datasets.0.borderColor"), undefined);
  assert.equal(at(out, "data.datasets.0.backgroundColor"), "#p1");
  assert.equal(at(out, "data.datasets.1.borderColor"), "#p2");
  assert.equal(at(out, "data.datasets.1.backgroundColor"), "#p2");
  assert.equal(at(out, "data.datasets.2.backgroundColor"), withAlpha("#p3", 0.3));
});

void test("theme fill reaches the axes a config leaves out and no others", () => {
  const timeOnly = fillThemeDefaults({
    type: "line",
    data: { datasets: [{ data: [] }, { data: [], yAxisID: "y2" }] },
    options: { scales: { x: { type: "time" } } },
  } as unknown as ChartConfiguration, theme);
  assert.equal(at(timeOnly.options, "scales.x.type"), "time");
  assert.equal(at(timeOnly.options, "scales.y.ticks.color"), "#111");
  assert.equal(at(timeOnly.options, "scales.y2.ticks.color"), "#111");
  assert.deepEqual(Object.keys(at(timeOnly.options, "scales") as object).sort(), ["x", "y", "y2"]);
});

void test("parseVarRef reads a variable with and without fallback", () => {
  assert.deepEqual(parseVarRef("var(--color-red)"), { name: "--color-red" });
  assert.deepEqual(parseVarRef("var( --x , #fff )"), { name: "--x", fallback: "#fff" });
  assert.equal(parseVarRef("#fff"), null);
});

void test("axes set range, direction and visibility, and a bound drops the grace", () => {
  const o = opts({ ...spec, axes: { y: { min: 0, max: 10, reverse: true, ticks: false, tickPadding: 6 }, x: { display: false } } });
  assert.equal(at(o, "scales.y.min"), 0);
  assert.equal(at(o, "scales.y.max"), 10);
  assert.equal(at(o, "scales.y.grace"), undefined);
  assert.equal(at(o, "scales.y.reverse"), true);
  assert.equal(at(o, "scales.y.ticks.display"), false);
  assert.equal(at(o, "scales.y.ticks.padding"), 6);
  assert.equal(at(o, "scales.y.ticks.color"), "#111");
  assert.equal(at(o, "scales.x.display"), false);
  assert.equal(at(opts(spec), "scales.y.grace"), "5%");
});

void test("x and y name the drawn axes on a horizontal chart too", () => {
  const o = opts({ ...spec, horizontal: true, axes: { x: { max: 8 } } });
  assert.equal(at(o, "scales.x.max"), 8);
  assert.equal(at(o, "scales.y.max"), undefined);
});

void test("the radial scale takes axes.r", () => {
  const o = opts({ kind: "radar", labels: ["a", "b", "c"], series: [{ name: "n", values: [1, 2, 3] }], axes: { r: { min: 1, max: 5 } } });
  assert.equal(at(o, "scales.r.min"), 1);
  assert.equal(at(o, "scales.r.max"), 5);
});

void test("labelColors gives bars one palette color per label", () => {
  const ds = (s: ChartSpec): unknown => buildConfig(s, theme).data.datasets.map((d) => d.backgroundColor);
  assert.deepEqual(ds(spec), ["#p1"]);
  assert.deepEqual(ds({ ...spec, labelColors: true }), [["#p1", "#p2"]]);
  const two = { ...spec, series: [{ name: "n", values: [2, 4] }, { name: "m", values: [1, 3] }], labelColors: true };
  assert.deepEqual(ds(two), [["#p1", "#p2"], ["#p1", "#p2"]]);
});

void test("legend, tension and beginAtZero override the defaults", () => {
  assert.equal(at(opts({ ...spec, legend: true }), "plugins.legend.display"), true);
  assert.equal(at(opts({ ...spec, kind: "pie", legend: false }), "plugins.legend.display"), false);
  assert.equal(at(opts({ ...spec, legend: "bottom" }), "plugins.legend.position"), "bottom");
  assert.equal(at(opts(spec), "scales.y.beginAtZero"), true);
  assert.equal(at(opts({ ...spec, beginAtZero: false }), "scales.y.beginAtZero"), false);
  const line = buildConfig({ ...spec, kind: "line", tension: 0 }, theme);
  assert.equal(at(line, "data.datasets.0.tension"), 0);
});

void test("the default curve is monotone so it cannot overshoot; a set tension keeps its own curve", () => {
  const curved = (tension?: number) => buildConfig({ ...spec, kind: "line", ...(tension === undefined ? {} : { tension }) }, theme);
  assert.equal(at(curved(), "data.datasets.0.cubicInterpolationMode"), "monotone");
  assert.equal(at(curved(0.6), "data.datasets.0.cubicInterpolationMode"), undefined);
  assert.equal(at(curved(0.6), "data.datasets.0.tension"), 0.6);
  assert.equal(at(curved(0), "data.datasets.0.cubicInterpolationMode"), undefined);
});

void test("series steps, dots and hidden state reach the datasets", () => {
  const line = buildConfig({ ...spec, kind: "line", spanGaps: true, series: [{ name: "n", values: [2, null], stepped: "after", pointRadius: 0, hidden: true }] }, theme);
  assert.equal(at(line, "data.datasets.0.stepped"), "after");
  assert.equal(at(line, "data.datasets.0.pointRadius"), 0);
  assert.equal(at(line, "data.datasets.0.hidden"), true);
  assert.equal(at(line, "data.datasets.0.spanGaps"), true);
  const plain = buildConfig({ ...spec, kind: "line" }, theme);
  for (const key of ["stepped", "pointRadius", "hidden"]) assert.equal(at(plain, `data.datasets.0.${key}`), undefined);
  assert.equal(at(plain, "data.datasets.0.spanGaps"), false);
  assert.equal(at(buildConfig({ ...spec, series: [{ name: "n", values: [2, 4], hidden: true }] }, theme), "data.datasets.0.hidden"), true);
});

void test("a gap stays a gap and does not break integer detection", () => {
  const c = buildConfig({ ...spec, kind: "line", series: [{ name: "n", values: [2, null] }] }, theme);
  assert.deepEqual(at(c, "data.datasets.0.data"), [2, null]);
  assert.equal(at(c.options, "scales.y.ticks.precision"), 0);
});

void test("chart text follows the note's text size, a step smaller outside the title", () => {
  const o = opts({ ...spec, title: "t" });
  const small = { family: "Inter", size: 17 };
  assert.deepEqual(at(o, "plugins.legend.labels.font"), small);
  assert.deepEqual(at(o, "scales.x.ticks.font"), small);
  assert.deepEqual(at(o, "scales.y.ticks.font"), small);
  assert.deepEqual(at(o, "plugins.title.font"), { family: "Inter", size: 20, weight: "bold" });
  assert.deepEqual(at(o, "layout.padding"), { top: 25 });
  const raw = fillThemeDefaults({ type: "bar", data: { datasets: [] }, options: { plugins: { legend: { labels: { font: { size: 9 } } } } } }, theme);
  assert.deepEqual(at(raw.options, "plugins.legend.labels.font"), { size: 9, family: "Inter" });
  assert.deepEqual(at(raw.options, "scales.x.ticks.font"), small);
});

void test("withAlpha turns hex and rgb into rgba and leaves other forms alone", () => {
  assert.equal(withAlpha("#ff8000", 0.25), "rgba(255, 128, 0, 0.25)");
  assert.equal(withAlpha("#f80", 0.5), "rgba(255, 136, 0, 0.5)");
  assert.equal(withAlpha("rgb(1, 2, 3)", 0.25), "rgba(1, 2, 3, 0.25)");
  assert.equal(withAlpha("rgba(1, 2, 3, 0.9)", 0.25), "rgba(1, 2, 3, 0.25)");
  assert.equal(withAlpha("red", 0.25), "red");
});

void test("theme fill colours annotations the config left unpainted", () => {
  const config = {
    type: "line",
    data: { labels: ["a"], datasets: [{ data: [1] }] },
    options: {
      plugins: {
        annotation: {
          annotations: {
            goal: { type: "line", yMin: 5, yMax: 5 },
            kept: { type: "line", yMin: 6, yMax: 6, borderColor: "red" },
            note: { type: "label", content: "x" },
          },
        },
      },
    },
  } as unknown as ChartConfiguration;
  const o = fillThemeDefaults(config, theme).options;
  assert.equal(at(o, "plugins.annotation.annotations.goal.borderColor"), "#111");
  assert.equal(at(o, "plugins.annotation.annotations.goal.yMin"), 5);
  assert.equal(at(o, "plugins.annotation.annotations.kept.borderColor"), "red");
  assert.equal(at(o, "plugins.annotation.annotations.note.color"), "#111");

  const listed = fillThemeDefaults({ ...config, options: { plugins: { annotation: { annotations: [{ type: "box" }] } } } } as unknown as ChartConfiguration, theme).options;
  assert.equal(at(listed, "plugins.annotation.annotations.0.borderColor"), "#111");
});

void test("theme fill colours sankey nodes by name, then by palette", () => {
  const config = {
    type: "sankey",
    data: { datasets: [{
      data: [{ from: "a", to: "b", flow: 1 }, { from: "c", to: "b", flow: 2 }],
      colorFrom: { c: "navy" },
    }] },
  } as unknown as ChartConfiguration;
  const ds = fillThemeDefaults(config, theme).data.datasets[0] as unknown as Record<string, unknown>;
  assert.equal(ds["color"], "#111");
  const pick = (key: "colorFrom" | "colorTo", i: number) =>
    (ds[key] as (c: unknown) => string)({ dataset: ds, dataIndex: i });
  assert.equal(pick("colorFrom", 0), "#p1");
  assert.equal(pick("colorFrom", 1), "navy");
  assert.equal(pick("colorTo", 0), "#p2");
});

void test("var() colours in a raw config resolve under colour keys only", () => {
  const config = {
    type: "sankey",
    data: { datasets: [{
      data: [{ from: "a", to: "b", flow: 1 }],
      colorFrom: { a: "var(--color-red)", b: "navy" },
      backgroundColor: ["var(--color-blue)", "#fff"],
      label: "var(--not-a-colour)",
    }] },
    options: { font: { family: "var(--font-text)" }, plugins: { legend: { labels: { color: "var(--text-muted)" } } } },
  };
  const out = resolveConfigColors(config, (c) => `resolved ${c}`);
  const ds = out.data.datasets[0]!;
  assert.deepEqual(ds.colorFrom, { a: "resolved var(--color-red)", b: "navy" });
  assert.deepEqual(ds.backgroundColor, ["resolved var(--color-blue)", "#fff"]);
  assert.equal(ds.label, "var(--not-a-colour)");
  assert.equal(out.options.font.family, "var(--font-text)");
  assert.equal(out.options.plugins.legend.labels.color, "resolved var(--text-muted)");
  assert.equal(config.data.datasets[0]!.colorFrom.a, "var(--color-red)");
});

void test("reference lines go on their axis, a number that is a label as the label", () => {
  const years: ChartSpec = { kind: "line", labels: ["2023", "2024"], series: [{ name: "n", values: [2, 4] }], referenceLines: { x: [2024], y: [3, 5] } };
  const lines = at(opts(years), "plugins.annotation.annotations") as Record<string, unknown>[];
  assert.deepEqual(lines.map((l) => [l.scaleID, l.value, l.borderColor]), [["x", "2024", "#111"], ["y", 3, "#111"], ["y", 5, "#111"]]);
  assert.equal(at(opts(spec), "plugins.annotation"), undefined);
  assert.equal(at(opts({ ...spec, kind: "pie", referenceLines: { y: [1] } }), "plugins.annotation"), undefined);
});

void test("average draws each series' mean in its color, on the value axis", () => {
  const two: ChartSpec = { kind: "bar", labels: ["a", "b", "c"], average: true, horizontal: true,
    series: [{ name: "n", values: [2, null, 4] }, { name: "m", values: [1, 2, 6], color: "red" }] };
  const lines = at(opts(two), "plugins.annotation.annotations") as Record<string, unknown>[];
  assert.deepEqual(lines.map((l) => [l.scaleID, l.value, l.borderColor]), [["x", 3, "#p1"], ["x", 3, "red"]]);
  const hidden = { chart: { isDatasetVisible: (i: number) => i !== 1 } };
  assert.deepEqual(lines.map((l) => (l.display as (c: typeof hidden) => boolean)(hidden)), [true, false]);
});

void test("bestFitValues fits a straight line by position, skipping gaps", () => {
  assert.deepEqual(bestFitValues([1, 3, 5, 7]), [1, 3, 5, 7]);
  assert.deepEqual(bestFitValues([1, null, 2, 6]), [0.5, 2, 3.5, 5]);
  assert.deepEqual(bestFitValues([1, 2, 2]), [1.16667, 1.66667, 2.16667]);
  assert.equal(bestFitValues([4, null]), undefined);
});

void test("bestFit adds a dashed trend line for the chosen series, on line charts only", () => {
  const line: ChartSpec = { kind: "line", labels: ["Jan", "Feb", "Mar"], bestFit: true, bestFitNumber: 1, bestFitTitle: "Trend",
    series: [{ name: "n", values: [5, 5, 5] }, { name: "m", values: [1, 2, 3] }] };
  const config = buildConfig(line, theme);
  const fit = config.data.datasets[2] as unknown as Record<string, unknown>;
  assert.deepEqual([fit.label, fit.data, fit.borderColor, fit.pointRadius], ["Trend", [1, 2, 3], "#p3", 0]);
  assert.equal(buildConfig({ ...line, bestFitTitle: undefined }, theme).data.datasets[2]!.label, "Line of Best Fit");
  assert.equal(buildConfig({ ...line, kind: "bar" }, theme).data.datasets.length, 2);
  const one: ChartSpec = { kind: "line", labels: ["a", "b"], bestFit: true, series: [{ name: "n", values: [1, 2] }] };
  assert.equal(at(opts(one), "plugins.legend.display"), true);
});

void test("stacked averages sit on top of the series below, stacked line fills run to the previous series", () => {
  const stackedLine: ChartSpec = { kind: "line", labels: ["a", "b"], stacked: true, average: true,
    series: [{ name: "n", values: [2, 4], fill: true }, { name: "m", values: [1, 3], fill: true }, { name: "o", values: [1, 1] }] };
  const lines = at(opts(stackedLine), "plugins.annotation.annotations") as Record<string, unknown>[];
  assert.deepEqual(lines.map((l) => l.value), [3, 5, 6]);
  const fills = buildConfig(stackedLine, theme).data.datasets.map((d) => (d as unknown as Record<string, unknown>).fill);
  assert.deepEqual(fills, ["origin", "-1", false]);
  const flat = buildConfig({ ...stackedLine, stacked: false }, theme).data.datasets.map((d) => (d as unknown as Record<string, unknown>).fill);
  assert.deepEqual(flat, [true, true, false]);
  const unstacked = at(opts({ ...stackedLine, stacked: false }), "plugins.annotation.annotations") as Record<string, unknown>[];
  assert.deepEqual(unstacked.map((l) => l.value), [3, 2, 1]);
});

void test("wrapTitle breaks at words to fit, leaves a fitting title alone", () => {
  const w = (s: string): number => s.length * 10;
  assert.equal(wrapTitle("short title", 200, w), "short title");
  assert.deepEqual(wrapTitle("aaa bbb ccc ddd", 80, w), ["aaa bbb", "ccc ddd"]);
  assert.deepEqual(wrapTitle("a verylongwordhere b", 60, w), ["a", "verylongwordhere", "b"]);
  assert.equal(wrapTitle("unbreakable", 50, w), "unbreakable");
});

void test("a title brings its wrap plugin, a radar with rMax its clip, and neither without", () => {
  const ids = (s: ChartSpec): string[] => (buildConfig(s, theme).plugins ?? []).map((p) => p.id);
  assert.deepEqual(ids({ ...spec, title: "T", valueLabels: false }), ["chartworkTitleWrap"]);
  const radar: ChartSpec = { kind: "radar", labels: ["a", "b", "c"], series: [{ name: "n", values: [1, 9, 2] }] };
  assert.deepEqual(ids(radar), []);
  assert.deepEqual(ids({ ...radar, axes: { r: { max: 5 } } }), ["chartworkRadialClip"]);
});

void test("dateUnit draws bar and line labels on a time axis in date order", () => {
  const dated: ChartSpec = {
    kind: "line", labels: ["2026-03-01", "2026-01-01"], series: [{ name: "n", values: [3, 1] }],
    dateUnit: "month", sort: "value", topN: 1,
  };
  assert.equal(at(opts(dated), "scales.x.type"), "time");
  assert.equal(at(opts(dated), "scales.x.time.unit"), "month");
  assert.deepEqual(prepareData(dated).labels, ["2026-01-01", "2026-03-01"]);
  assert.equal(at(opts({ ...dated, kind: "bar", horizontal: true }), "scales.y.reverse"), true);
  assert.equal(at(opts({ ...dated, kind: "pie" }), "scales"), undefined);
});

// Stands in for the moment adapter, in UTC so the test reads the same anywhere
const fakeAdapter = {
  startOf(time: number, unit: string): number {
    const d = new Date(time);
    if (unit === "year") return Date.UTC(d.getUTCFullYear(), 0, 1);
    if (unit === "month") return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  },
  format: (time: number, format: string) => `${format} ${new Date(time).toISOString().slice(0, 10)}`,
};

void test("a date off the start of its unit hovers as the full date, and a unit's first day keeps the unit's format", () => {
  const dated: ChartSpec = { kind: "line", labels: ["2026-08-01", "2026-08-22"], series: [{ name: "n", values: [1, 2] }], dateUnit: "month" };
  type Title = (items: unknown[]) => string;
  const title = (spec: ChartSpec, date: string, axis = "x"): string => {
    const fn = at(opts(spec), "plugins.tooltip.callbacks.title") as Title;
    return fn([{ chart: { scales: { [axis]: { _adapter: fakeAdapter } } }, parsed: { [axis]: Date.parse(date) }, label: "unit label" }]);
  };
  assert.equal(title(dated, "2026-08-01"), "unit label");
  assert.equal(title(dated, "2026-08-22"), "ll 2026-08-22");
  const yearly: ChartSpec = { ...dated, dateUnit: "year" };
  assert.equal(title(yearly, "2026-01-01"), "unit label");
  assert.equal(title(yearly, "2026-08-01"), "ll 2026-08-01");
  const weekly: ChartSpec = { ...dated, kind: "bar", horizontal: true, dateUnit: "week" };
  assert.equal(title(weekly, "2026-08-17", "y"), "unit label");
  assert.equal(title(weekly, "2026-08-19", "y"), "ll 2026-08-19");
  const stacked: ChartSpec = { ...dated, kind: "bar", stacked: true, series: [{ name: "a", values: [1, 2] }, { name: "b", values: [3, 4] }] };
  assert.equal(typeof at(opts(stacked), "plugins.tooltip.callbacks.footer"), "function");
  assert.equal(title(stacked, "2026-08-22"), "ll 2026-08-22");
  assert.equal(at(opts({ ...dated, dateUnit: "day" }), "plugins.tooltip.callbacks"), undefined);
});

const scatter: ChartSpec = {
  kind: "scatter",
  labels: [],
  xTitle: "Hours",
  valueTitle: "Score",
  series: [{ name: "Notes", values: [], points: [{ x: 1, y: 2, name: "Alpha", radius: 9 }, { x: 3, y: 4, name: "Beta" }] }],
};

void test("scatter draws {x, y} points with linear axes and per-point radius", () => {
  const config = buildConfig(scatter, theme);
  assert.equal(config.type, "scatter");
  const ds = config.data.datasets[0] as unknown as Record<string, unknown>;
  assert.deepEqual(ds.data, [{ x: 1, y: 2, name: "Alpha" }, { x: 3, y: 4, name: "Beta" }]);
  assert.deepEqual(ds.pointRadius, [9, 4]);
  assert.equal(at(config.options, "scales.x.type"), "linear");
  assert.equal(at(config.options, "scales.x.title.text"), "Hours");
  assert.equal(at(config.options, "scales.y.title.text"), "Score");
  assert.equal(at(config.options, "scales.y.beginAtZero"), false);
});

void test("scatter tooltip shows the note name and each value on its own line", () => {
  const callbacks = at(buildConfig(scatter, theme).options, "plugins.tooltip.callbacks") as {
    title(items: unknown[]): string;
    label(item: unknown): string[];
  };
  const raw = { x: 1, y: 2, name: "Alpha" };
  assert.equal(callbacks.title([{ raw }]), "Alpha");
  assert.deepEqual(callbacks.label({ raw }), ["Hours: 1", "Score: 2"]);
});

void test("scatter tooltip names the group only when there are several", () => {
  const point = { raw: { x: 1, y: 2, name: "Alpha" }, dataset: { label: "Read" } };
  type Label = { label(item: unknown): string[] };
  const single = at(buildConfig(scatter, theme).options, "plugins.tooltip.callbacks") as Label;
  assert.deepEqual(single.label(point), ["Hours: 1", "Score: 2"]);
  const grouped = { ...scatter, series: [...scatter.series, { ...scatter.series[0], name: "Dropped" }] } as typeof scatter;
  const callbacks = at(buildConfig(grouped, theme).options, "plugins.tooltip.callbacks") as Label;
  assert.deepEqual(callbacks.label(point), ["Read", "Hours: 1", "Score: 2"]);
});

void test("no chart tooltip has a color key, and a raw config keeps one with a gap after it", () => {
  assert.equal(at(buildConfig(spec, theme).options, "plugins.tooltip.displayColors"), false);
  assert.equal(at(buildConfig(scatter, theme).options, "plugins.tooltip.displayColors"), false);
  const raw = (options: object) => at(fillThemeDefaults({ type: "bar", data: { datasets: [] }, options }, theme).options, "plugins.tooltip.boxPadding");
  assert.equal(raw({}), 4);
  assert.equal(raw({ plugins: { tooltip: { boxPadding: 9 } } }), 9);
});

void test("every tooltip has an outline in the theme's text color, and a raw config can replace it", () => {
  const outline = withAlpha(theme.text, 0.4);
  assert.equal(at(buildConfig(spec, theme).options, "plugins.tooltip.borderColor"), outline);
  assert.equal(at(buildConfig(scatter, theme).options, "plugins.tooltip.borderWidth"), 1);
  const raw = (options: object) => fillThemeDefaults({ type: "bar", data: { datasets: [] }, options }, theme).options;
  assert.equal(at(raw({}), "plugins.tooltip.borderColor"), outline);
  assert.equal(at(raw({}), "plugins.tooltip.borderWidth"), 1);
  assert.equal(at(raw({ plugins: { tooltip: { borderWidth: 0 } } }), "plugins.tooltip.borderWidth"), 0);
});

void test("scatter tooltip adds the size value, only for a point that has one", () => {
  const sized: ChartSpec = { ...scatter, sizeTitle: "Rating" };
  const config = buildConfig(sized, theme);
  const callbacks = at(config.options, "plugins.tooltip.callbacks") as { label(item: unknown): string[] };
  assert.deepEqual(callbacks.label({ raw: { x: 1, y: 2, name: "Alpha", size: 4.5 } }), ["Hours: 1", "Score: 2", "Rating: 4.5"]);
  assert.deepEqual(callbacks.label({ raw: { x: 1, y: 2, name: "Beta" } }), ["Hours: 1", "Score: 2"]);
});

void test("scatter carries a point's size value into the chart data", () => {
  const spec: ChartSpec = { kind: "scatter", labels: [], series: [{ name: "Notes", values: [], points: [{ x: 1, y: 2, name: "a", radius: 9, size: 4 }, { x: 3, y: 4, name: "b", radius: 9 }] }] };
  assert.deepEqual(buildConfig(spec, theme).data.datasets[0]?.data, [{ x: 1, y: 2, name: "a", size: 4 }, { x: 3, y: 4, name: "b" }]);
});

void test("stacked tooltip totals the series showing", () => {
  const stacked: ChartSpec = { kind: "bar", stacked: true, labels: ["a", "b"], series: [{ name: "x", values: [1, 2] }, { name: "y", values: [3, null] }, { name: "z", values: [10, 20] }] };
  const { footer } = at(buildConfig(stacked, theme).options, "plugins.tooltip.callbacks") as { footer: (items: unknown[]) => string };
  const hover = (dataIndex: number, hidden: number[] = [], datasetIndex = 0) => [{ chart: { isDatasetVisible: (i: number) => !hidden.includes(i) }, dataIndex, datasetIndex }];
  assert.equal(footer(hover(0)), "Total: 14");
  assert.equal(footer(hover(1)), "Total: 22");
  assert.equal(footer(hover(0, [2])), "Total: 4");
  assert.equal(footer(hover(0, [1, 2])), "");
  assert.equal(footer(hover(1, [2])), "");
  assert.equal(footer(hover(0, [], 3)), "");
});

void test("every bar chart sets its tooltip beside the bar, and other kinds keep the default", () => {
  const bar: ChartSpec = { kind: "bar", stacked: true, labels: ["a"], series: [{ name: "x", values: [1] }, { name: "y", values: [2] }] };
  const position = (spec: ChartSpec) => at(buildConfig(spec, theme).options, "plugins.tooltip.position");
  assert.equal(position(bar), "barSide");
  assert.equal(position({ ...bar, horizontal: true }), "barSide");
  assert.equal(position({ ...bar, stacked: false }), "barSide");
  assert.equal(position({ ...bar, kind: "line" }), undefined);
  assert.equal(position({ ...bar, kind: "pie" }), undefined);
});

void test("a line point takes a fingertip-sized hit area", () => {
  const line: ChartSpec = { kind: "line", labels: ["a", "b"], series: [{ name: "x", values: [1, 2] }] };
  const dataset = buildConfig(line, theme).data.datasets[0] as unknown as Record<string, unknown>;
  assert.equal(dataset.pointHitRadius, 20);
});

void test("barSide sits beside the bar, level with its middle, on the roomier side", () => {
  const model = { chart: { chartArea: { left: 0, right: 100, top: 0, bottom: 100 } } } as never;
  const place = (props: object) => barSide.call(model, [{ element: new BarElement(props as never), datasetIndex: 0, index: 0 }]);
  const upright = { horizontal: false, y: 20, base: 60, width: 10, height: 40 };
  assert.deepEqual(place({ ...upright, x: 30 }), { x: 35, y: 40, xAlign: "left", yAlign: "center" });
  assert.deepEqual(place({ ...upright, x: 70 }), { x: 65, y: 40, xAlign: "right", yAlign: "center" });
  const lying = { horizontal: true, x: 60, base: 20, width: 40, height: 10 };
  assert.deepEqual(place({ ...lying, y: 30 }), { x: 40, y: 35, xAlign: "center", yAlign: "top" });
  assert.deepEqual(place({ ...lying, y: 70 }), { x: 40, y: 65, xAlign: "center", yAlign: "bottom" });
});

void test("barSide gives up with nothing hovered", () => {
  const model = { chart: { chartArea: { left: 0, right: 100, top: 0, bottom: 100 } } } as never;
  assert.equal(barSide.call(model, []), false);
});

void test("stacked tooltip totals a running total's sums, and an unstacked chart has none", () => {
  const series = [{ name: "x", values: [1, 2] }, { name: "y", values: [3, 4] }];
  const cumulative: ChartSpec = { kind: "bar", stacked: true, cumulative: true, labels: ["a", "b"], series };
  const { footer } = at(buildConfig(cumulative, theme).options, "plugins.tooltip.callbacks") as { footer: (items: unknown[]) => string };
  assert.equal(footer([{ chart: { isDatasetVisible: () => true }, dataIndex: 1, datasetIndex: 0 }]), "Total: 10");
  const plain = at(buildConfig({ ...cumulative, stacked: false, cumulative: false }, theme).options, "plugins.tooltip") as { callbacks?: unknown };
  assert.equal(plain.callbacks, undefined);
});

void test("a hidden legend entry is grayed rather than struck through", () => {
  const shown = { text: "a", hidden: false, fontColor: "#111", fillStyle: "#f00", strokeStyle: "#f00" };
  const [kept, faded] = fadeHiddenEntries([shown, { ...shown, text: "b", hidden: true }], { ...theme, text: "#112233" });
  assert.deepEqual(kept, shown);
  assert.deepEqual(faded, { text: "b", hidden: false, fontColor: "rgba(17, 34, 51, 0.45)", fillStyle: "rgba(17, 34, 51, 0.25)", strokeStyle: "rgba(17, 34, 51, 0.25)" });
});

void test("scatter has no legend with one series", () => {
  assert.equal(at(buildConfig(scatter, theme).options, "plugins.legend.display"), false);
});

void test("a stacked running total sums each series first, and the average sits on the stack", () => {
  const run: ChartSpec = { kind: "bar", labels: ["a", "b"], stacked: true, cumulative: true, average: true, valueLabels: true,
    series: [{ name: "n", values: [1, 2] }, { name: "m", values: [2, 2] }] };
  const config = buildConfig(run, theme);
  assert.deepEqual(config.data.datasets.map((d) => d.data), [[1, 3], [2, 4]]);
  assert.equal(at(config.options, "scales.y.stacked"), true);
  const lines = at(config.options, "plugins.annotation.annotations") as Record<string, unknown>[];
  assert.deepEqual(lines.map((l) => l.value), [2, 5]);
  assert.equal(config.plugins?.length, 1);
});
