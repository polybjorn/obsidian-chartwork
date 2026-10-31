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
