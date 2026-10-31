import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseChartBlock } from "../src/codeblock/parse.ts";
import type { ParsedBlock } from "../src/codeblock/parse.ts";

function ok(input: unknown): ParsedBlock {
  const r = parseChartBlock(input);
  assert.ok(r.ok, r.ok ? "" : r.error);
  assert.ok("spec" in r.value);
  return r.value;
}

function err(input: unknown): string {
  const r = parseChartBlock(input);
  assert.ok(!r.ok);
  return r.error;
}

const base = { type: "bar", labels: ["a", "b"], series: [{ title: "S", data: [1, 2] }] };

// A block with every display key set and dated labels, as vault notes write them
void test("fixture: dated line chart with three filled series", () => {
  const input = JSON.parse(readFileSync(new URL("./fixtures/line-chart.json", import.meta.url), "utf8")) as Record<string, unknown>;
  const { spec, width } = ok(input);
  assert.equal(spec.kind, "line");
  assert.equal(spec.labels.length, 20);
  assert.equal(spec.labels[0], "2024-01-07");
  assert.equal(spec.labels[19], "2025-02-02");
  assert.deepEqual(spec.series.map((s) => s.name), ["Total", "Fiction", "Non-fiction"]);
  assert.ok(spec.series.every((s) => s.fill === true && s.values.length === 20));
  assert.equal(spec.series[0]?.values[19], 7090);
  assert.equal(spec.valueTitle, "Pages");
  assert.equal(width, "80%");
  assert.equal(spec.horizontal, undefined);
});

void test("bar defaults carry no extras", () => {
  const { spec, width } = ok(base);
  assert.deepEqual(spec, { kind: "bar", labels: ["a", "b"], series: [{ name: "S", values: [1, 2] }] });
  assert.equal(width, undefined);
});

void test("pie and doughnut map directly, case-insensitive", () => {
  assert.equal(ok({ ...base, type: "pie" }).spec.kind, "pie");
  assert.equal(ok({ ...base, type: "Doughnut", labelColors: true }).spec.kind, "doughnut");
});

void test("indexAxis y is horizontal and its value title is xTitle", () => {
  const { spec } = ok({ ...base, indexAxis: "y", xTitle: "Hours", yTitle: "ignored" });
  assert.equal(spec.horizontal, true);
  assert.equal(spec.valueTitle, "Hours");
});

void test("Charts' axis keys map per axis, x and y as Chart.js draws them", () => {
  const { spec } = ok({
    ...base, yMin: 0, yMax: 50, yReverse: true, yTickDisplay: false, yTickPadding: 8,
    xMin: "a", xDisplay: false, rMax: 9,
  });
  assert.deepEqual(spec.axes, {
    x: { min: "a", display: false },
    y: { min: 0, max: 50, reverse: true, ticks: false, tickPadding: 8 },
  });
});

void test("rMin and rMax set the radial scale, which takes numbers only", () => {
  const { spec } = ok({ ...base, type: "radar", rMin: 1, rMax: 5, yMax: 3 });
  assert.deepEqual(spec.axes, { r: { min: 1, max: 5 } });
  assert.equal(ok({ ...base, type: "polarArea", rMax: "5" }).spec.axes, undefined);
});

void test("labelColors applies to bar charts", () => {
  assert.equal(ok({ ...base, labelColors: true }).spec.labelColors, true);
  assert.equal(ok({ ...base, type: "line", labelColors: true }).spec.labelColors, undefined);
});

void test("stacked maps for bar and line", () => {
  assert.equal(ok({ ...base, stacked: true }).spec.stacked, true);
  assert.equal(ok({ ...base, type: "line", stacked: false }).spec.stacked, undefined);
});

void test("fill applies to line series only", () => {
  assert.equal(ok({ ...base, type: "line", fill: true }).spec.series[0]?.fill, true);
  assert.equal(ok({ ...base, fill: true }).spec.series[0]?.fill, undefined);
});

void test("a radar block fills each shape unless fill is false", () => {
  const radar = { ...base, type: "radar" };
  assert.equal(ok(radar).spec.kind, "radar");
  assert.equal(ok(radar).spec.series[0]?.fill, true);
  assert.equal(ok({ ...radar, fill: false }).spec.series[0]?.fill, false);
});

void test("polarArea is read in any case", () => {
  for (const t of ["polarArea", "polararea", "PolarArea"]) assert.equal(ok({ ...base, type: t }).spec.kind, "polarArea");
});

void test("width accepts a string or a number of pixels", () => {
  assert.equal(ok({ ...base, width: "40%" }).width, "40%");
  assert.equal(ok({ ...base, width: 300 }).width, "300px");
});

void test("labels may be numbers or dates, a missing title gets a name, null is a gap", () => {
  const { spec } = ok({ type: "line", labels: [2024, new Date("2025-01-02")], series: [{ data: [1, null] }] });
  assert.deepEqual(spec.labels, ["2024", "2025-01-02"]);
  assert.equal(spec.series[0]?.name, "Series 1");
  assert.equal(spec.series[0]?.values[1], null);
});

void test("unsupported types are rejected with the choices", () => {
  assert.match(err({ ...base, type: "bubble" }), /bar, line, pie, doughnut, radar, polarArea, scatter or sankey/);
});

void test("series keep Charts' stepped, hidden and pointRadius, and the block its spanGaps", () => {
  const line = { type: "line", labels: ["a", "b"], spanGaps: true, series: [{ title: "S", data: [1, null], stepped: true, hidden: true, pointRadius: 0 }, { title: "T", data: [2, 3], stepped: "middle" }] };
  const { spec } = ok(line);
  assert.equal(spec.spanGaps, true);
  assert.deepEqual(spec.series.map((s) => [s.stepped, s.hidden, s.pointRadius]), [[true, true, 0], ["middle", undefined, undefined]]);
  assert.match(err({ ...line, series: [{ title: "S", data: [1, 2], stepped: "up" }] }), /Series 1: stepped must be true, false, before, after or middle/);
  // Keys that mean nothing for the chart type are left out
  const bar = ok({ ...base, spanGaps: true, series: [{ title: "S", data: [1, 2], stepped: true, pointRadius: 0, hidden: true }] }).spec;
  assert.equal(bar.spanGaps, undefined);
  assert.deepEqual([bar.series[0]?.stepped, bar.series[0]?.pointRadius, bar.series[0]?.hidden], [undefined, undefined, true]);
  assert.equal(ok({ ...base, type: "pie", series: [{ title: "S", data: [1, 2], hidden: true }] }).spec.series[0]?.hidden, undefined);
});

void test("a title shows above the chart, sankey included", () => {
  assert.equal(ok({ ...base, title: "Reading" }).spec.title, "Reading");
  assert.equal(ok({ ...base, title: 2024 }).spec.title, "2024");
  assert.equal(ok(base).spec.title, undefined);
  const r = parseChartBlock({ type: "sankey", title: "Flow", series: [{ data: [["A", 1, "B"]] }] });
  assert.ok(r.ok && "config" in r.value);
  assert.deepEqual(r.value.config.options?.plugins?.title, { display: true, text: "Flow" });
});

void test("valueLabels turns value labels on or off, except on a radar", () => {
  assert.equal(ok({ ...base, type: "pie", valueLabels: true }).spec.valueLabels, true);
  assert.equal(ok({ ...base, valueLabels: false }).spec.valueLabels, false);
  assert.equal(ok({ ...base, type: "radar", valueLabels: true }).spec.valueLabels, undefined);
});

void test("invalid input gives readable errors", () => {
  assert.match(err(null), /empty/);
  assert.match(err("text"), /empty/);
  assert.match(err({ ...base, type: undefined }), /needs a type/);
  assert.match(err({ ...base, labels: undefined }), /needs labels/);
  assert.match(err({ ...base, series: [] }), /needs series/);
  assert.match(err({ ...base, series: ["x"] }), /Series 1/);
  assert.match(err({ ...base, series: [{ title: "S" }] }), /data list/);
  assert.match(err({ ...base, series: [{ data: [1, "x"] }] }), /not a number/);
  assert.match(err({ ...base, indexAxis: "z" }), /indexAxis/);
  assert.match(err({ type: "bar", id: "" }), /block id/);
  assert.match(err({ type: "bar", id: "t", layout: "diagonal" }), /layout/);
  assert.match(err({ type: "bar", id: "t", select: [{}] }), /select/);
});

void test("a block with id: refers to a table and needs no labels or series", () => {
  const { spec, table } = ok({ type: "bar", id: "^sales", layout: "rows", select: ["Data2", 3], file: "Notes.md", fill: true });
  assert.deepEqual(table, { id: "sales", layout: "rows", select: ["Data2", "3"], file: "Notes.md", fill: true });
  assert.deepEqual(spec.labels, []);
  assert.deepEqual(spec.series, []);
  assert.equal(ok({ type: "bar", id: "t" }).table?.layout, "columns");
});

void test("series given next to id: win over the table", () => {
  assert.equal(ok({ ...base, id: "t" }).table, undefined);
});

void test("a sankey block becomes a Chart.js config with from/to/flow rows", () => {
  const r = parseChartBlock({
    type: "sankey",
    width: "60%",
    series: [{
      data: [["Oil", 15, "Energy"], ["Coal", 25, "Energy"]],
      priority: { Oil: 1 },
      colorFrom: { Oil: "black" },
    }],
  });
  assert.ok(r.ok && "config" in r.value);
  const config = r.value.config as unknown as { type: string; data: { datasets: Record<string, unknown>[] } };
  assert.equal(config.type, "sankey");
  assert.deepEqual(config.data.datasets[0]?.["data"], [
    { from: "Oil", to: "Energy", flow: 15 },
    { from: "Coal", to: "Energy", flow: 25 },
  ]);
  assert.deepEqual(config.data.datasets[0]?.["priority"], { Oil: 1 });
  assert.deepEqual(config.data.datasets[0]?.["colorFrom"], { Oil: "black" });
  assert.equal(r.value.width, "60%");
});

void test("a scatter block becomes a Chart.js config of {x, y} points", () => {
  const r = parseChartBlock({
    type: "Scatter",
    title: "Height and weight",
    xTitle: "cm",
    yMin: 40,
    legendPosition: "bottom",
    width: 400,
    series: [
      { title: "A", data: [{ x: 160, y: 55 }, [172, 68]], pointRadius: 5 },
      { data: [{ x: 181, y: 80 }], hidden: true },
    ],
  });
  assert.ok(r.ok && "config" in r.value);
  const config = r.value.config as unknown as { type: string; data: { datasets: Record<string, unknown>[] }; options: Record<string, unknown> };
  assert.equal(config.type, "scatter");
  assert.deepEqual(config.data.datasets, [
    { label: "A", data: [{ x: 160, y: 55 }, { x: 172, y: 68 }], pointRadius: 5 },
    { label: "Series 2", data: [{ x: 181, y: 80 }], hidden: true },
  ]);
  assert.deepEqual(config.options, {
    scales: { x: { title: { display: true, text: "cm" } }, y: { min: 40 } },
    plugins: { legend: { display: true, position: "bottom" }, title: { display: true, text: "Height and weight" } },
  });
  assert.equal(r.value.width, "400px");
});

void test("a scatter block shows a legend for more than one series unless told", () => {
  const legend = (block: Record<string, unknown>): unknown => {
    const r = parseChartBlock({ type: "scatter", series: [{ data: [[1, 2]] }], ...block });
    return r.ok && "config" in r.value ? (r.value.config.options?.plugins?.legend as { display: unknown }).display : "fail";
  };
  assert.equal(legend({}), false);
  assert.equal(legend({ series: [{ data: [[1, 2]] }, { data: [[3, 4]] }] }), true);
  assert.equal(legend({ legend: true }), true);
  assert.equal(legend({ legend: false, legendPosition: "left" }), false);
});

void test("a scatter block with bad points says what is wrong", () => {
  assert.match(err({ type: "scatter" }), /data of points/);
  assert.match(err({ type: "scatter", series: [{ title: "A" }] }), /Series 1 needs a data list of points/);
  assert.match(err({ type: "scatter", series: [{ data: [{ x: 1 }] }] }), /Series 1 has a point without a number for x and y/);
  assert.match(err({ type: "scatter", series: [{ data: [3] }] }), /without a number/);
});

void test("a sankey block with bad rows says what is wrong", () => {
  assert.match(err({ type: "sankey" }), /rows of \[from, flow, to\]/);
  assert.match(err({ type: "sankey", series: [{ data: [["a", "x", "b"]] }] }), /number for the flow/);
  assert.match(err({ type: "sankey", series: [{ data: [["a", 1]] }] }), /\[from, flow, to\]/);
});

void test("xLine and yLine take a value or a label, or a list, and average a boolean", () => {
  const { spec } = ok({ ...base, yLine: [4, 6], xLine: "b", average: true });
  assert.deepEqual(spec.referenceLines, { y: [4, 6], x: ["b"] });
  assert.equal(spec.average, true);
  assert.deepEqual(ok({ ...base, xLine: new Date("2024-01-05") }).spec.referenceLines, { x: ["2024-01-05"] });
  assert.match(err({ ...base, yLine: [4, { at: 6 }] }), /yLine must be a value or a label/);
  const pie = ok({ ...base, type: "pie", yLine: 4, average: true }).spec;
  assert.equal(pie.referenceLines, undefined);
  assert.equal(pie.average, undefined);
});

void test("bestFit keys apply to line charts, bestFitNumber counting from 0", () => {
  const { spec } = ok({ ...base, type: "line", bestFit: true, bestFitTitle: "Trend", bestFitNumber: 0 });
  assert.deepEqual([spec.bestFit, spec.bestFitTitle, spec.bestFitNumber], [true, "Trend", 0]);
  assert.match(err({ ...base, type: "line", bestFit: true, bestFitNumber: "first" }), /bestFitNumber must be a series number/);
  assert.equal(ok({ ...base, bestFit: true }).spec.bestFit, undefined);
});
