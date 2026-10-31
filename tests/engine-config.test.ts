import { test } from "node:test";
import assert from "node:assert/strict";
import { bestFitValues, buildConfig, chartHeight, fillThemeDefaults, withAlpha } from "../src/engine/config.ts";
import type { Theme } from "../src/engine/theme.ts";
import { parseVarRef, resolveConfigColors } from "../src/engine/theme.ts";
import type { ChartSpec } from "../src/engine/spec.ts";
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
  assert.equal(chartHeight(spec), 300);
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
