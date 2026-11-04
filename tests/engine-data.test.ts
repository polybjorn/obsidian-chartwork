import { test } from "node:test";
import assert from "node:assert/strict";
import { allIntegers, prepareData } from "../src/engine/data.ts";
import type { ChartSpec } from "../src/engine/spec.ts";

const base: ChartSpec = {
  kind: "bar",
  labels: ["a", "b", "c", "d", "e"],
  series: [
    { name: "n", values: [3, 9, 1, 7, 5], color: ["red", "green", "blue", "gold", "gray"] },
    { name: "m", values: [30, 90, 10, 70, 50] },
  ],
};

void test("no options keeps the input order", () => {
  const out = prepareData(base);
  assert.deepEqual(out.labels, ["a", "b", "c", "d", "e"]);
  assert.deepEqual(out.series[0]?.values, [3, 9, 1, 7, 5]);
});

void test("sort by value moves every series and the colours with the labels", () => {
  const out = prepareData({ ...base, sort: "value" });
  assert.deepEqual(out.labels, ["b", "d", "e", "a", "c"]);
  assert.deepEqual(out.series[0]?.values, [9, 7, 5, 3, 1]);
  assert.deepEqual(out.series[1]?.values, [90, 70, 50, 30, 10]);
  assert.deepEqual(out.series[0]?.color, ["green", "gold", "gray", "red", "blue"]);
});

void test("order pins labels first and the rest follow sort", () => {
  const out = prepareData({ ...base, order: ["c", "a"], sort: "value" });
  assert.deepEqual(out.labels, ["c", "a", "b", "d", "e"]);
  assert.deepEqual(out.series[1]?.values, [10, 30, 90, 70, 50]);
});

void test("topN keeps the largest and implies sort by value", () => {
  const out = prepareData({ ...base, topN: 2 });
  assert.deepEqual(out.labels, ["b", "d"]);
  assert.deepEqual(out.series[0]?.color, ["green", "gold"]);
});

void test("topN with other sums the dropped categories for every series", () => {
  const out = prepareData({ ...base, topN: 2, other: "Other" });
  assert.deepEqual(out.labels, ["b", "d", "Other"]);
  assert.deepEqual(out.series[0]?.values, [9, 7, 9]);
  assert.deepEqual(out.series[1]?.values, [90, 70, 90]);
  assert.equal(out.series[0]?.color?.[2], "");
});

void test("order, sort, topN and other work together", () => {
  const out = prepareData({ ...base, order: ["e"], topN: 3, other: "Rest" });
  // topN keeps b, d, e; e is pinned first, b and d follow by value.
  assert.deepEqual(out.labels, ["e", "b", "d", "Rest"]);
  assert.deepEqual(out.series[0]?.values, [5, 9, 7, 4]);
});

void test("other is omitted when nothing was dropped", () => {
  const out = prepareData({ ...base, topN: 10, other: "Other" });
  assert.equal(out.labels.length, 5);
});

void test("detects integer-only data", () => {
  assert.equal(allIntegers([{ values: [1, 2, 3] }, { values: [0] }]), true);
  assert.equal(allIntegers([{ values: [1, 2.5] }]), false);
});

void test("cumulative sums after sort and topN, in the order drawn", () => {
  const sorted = prepareData({ ...base, cumulative: true, sort: "value" });
  assert.deepEqual(sorted.series[0]?.values, [9, 16, 21, 24, 25]);
  assert.deepEqual(sorted.series[1]?.values, [90, 160, 210, 240, 250]);
  const top = prepareData({ ...base, cumulative: true, topN: 2, other: "Rest" });
  assert.deepEqual(top.labels, ["b", "d", "Rest"]);
  assert.deepEqual(top.series[0]?.values, [9, 16, 25]);
});

void test("cumulative keeps a null as a gap and adds nothing", () => {
  const out = prepareData({ kind: "line", labels: ["a", "b", "c"], series: [{ name: "n", values: [2, null, 3] }], cumulative: true });
  assert.deepEqual(out.series[0]?.values, [2, null, 5]);
});

void test("cumulative follows date order on a time axis", () => {
  const out = prepareData({
    kind: "line", dateUnit: "day", cumulative: true,
    labels: ["2026-01-03", "2026-01-01", "2026-01-02"],
    series: [{ name: "n", values: [4, 1, 2] }],
  });
  assert.deepEqual(out.labels, ["2026-01-01", "2026-01-02", "2026-01-03"]);
  assert.deepEqual(out.series[0]?.values, [1, 3, 7]);
});

void test("cumulative is ignored for pie", () => {
  const out = prepareData({ ...base, kind: "pie", cumulative: true });
  assert.deepEqual(out.series[0]?.values, [3, 9, 1, 7, 5]);
});

void test("notes move with the labels, and other holds the notes it adds up", () => {
  const notes = [["a.md"], ["b.md"], ["c.md"], ["d.md"], ["e.md"]];
  const spec: ChartSpec = { ...base, series: [{ name: "n", values: [3, 9, 1, 7, 5], notes }] };
  assert.deepEqual(prepareData({ ...spec, sort: "value" }).series[0]?.notes, [["b.md"], ["d.md"], ["e.md"], ["a.md"], ["c.md"]]);
  assert.deepEqual(prepareData({ ...spec, topN: 2, other: "Rest" }).series[0]?.notes, [["b.md"], ["d.md"], ["e.md", "a.md", "c.md"]]);
});

void test("a running total lists only each label's own notes", () => {
  const spec: ChartSpec = { kind: "bar", labels: ["a", "b"], cumulative: true, series: [{ name: "n", values: [1, 2], notes: [["a.md"], ["b.md"]] }] };
  const out = prepareData(spec).series[0];
  assert.deepEqual(out?.values, [1, 3]);
  assert.deepEqual(out?.notes, [["a.md"], ["b.md"]]);
});
