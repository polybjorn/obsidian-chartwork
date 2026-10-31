import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseChartBlock } from "../src/codeblock/parse.ts";
import type { ParsedBlock } from "../src/codeblock/parse.ts";

function ok(input: unknown): ParsedBlock {
  const r = parseChartBlock(input);
  assert.ok(r.ok, r.ok ? "" : r.error);
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
  for (const t of ["polarArea", "sankey", "scatter"]) {
    assert.match(err({ ...base, type: t }), /bar, line, pie, doughnut or radar/);
  }
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
  assert.match(err({ type: "bar", id: "table" }), /table/);
});
