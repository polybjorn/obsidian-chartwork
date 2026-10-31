import { test } from "node:test";
import assert from "node:assert/strict";
import { aggregateRows, parseCategoryColors, xLabels, type AggregateOptions } from "../src/bases/aggregate.ts";

const base: AggregateOptions = { aggregation: "count", kind: "bar" };

void test("count buckets by x in first-seen order", () => {
  const spec = aggregateRows([{ x: "yes" }, { x: "no" }, { x: "yes" }], base);
  assert.deepEqual(spec.labels, ["yes", "no"]);
  assert.deepEqual(spec.series[0]?.values, [2, 1]);
  assert.equal(spec.series[0]?.name, "Count");
});

void test("sum and average parse numbers and numeric strings", () => {
  const rows = [{ x: "a", y: 2 }, { x: "a", y: "4" }, { x: "b", y: "1,5" }];
  const sum = aggregateRows(rows, { ...base, aggregation: "sum" });
  assert.deepEqual(sum.series[0]?.values, [6, 1.5]);
  const avg = aggregateRows(rows, { ...base, aggregation: "average" });
  assert.deepEqual(avg.series[0]?.values, [3, 1.5]);
});

void test("non-numeric values are skipped, not counted as zero", () => {
  const rows = [{ x: "a", y: 10 }, { x: "a", y: "n/a" }, { x: "a", y: null }, { x: "b", y: "" }];
  const avg = aggregateRows(rows, { ...base, aggregation: "average" });
  assert.deepEqual(avg.labels, ["a"]);
  assert.deepEqual(avg.series[0]?.values, [10]);
});

void test("a list x counts once per element", () => {
  const spec = aggregateRows([{ x: ["#a", "b"] }, { x: ["a"] }], base);
  assert.deepEqual(spec.labels, ["a", "b"]);
  assert.deepEqual(spec.series[0]?.values, [2, 1]);
});

void test("leading # is stripped and links show their display name", () => {
  assert.deepEqual(xLabels("#Project"), ["Project"]);
  assert.deepEqual(xLabels("[[Media/Movies|Films]]"), ["Films"]);
  assert.deepEqual(xLabels("[[Media/Movies.md]]"), ["Movies"]);
});

void test("missing x goes to a trailing (none) bucket, or is skipped", () => {
  const rows = [{ x: null }, { x: "a" }, { x: "" }, { x: [] }, { x: undefined }];
  const kept = aggregateRows(rows, base);
  assert.deepEqual(kept.labels, ["a", "(none)"]);
  assert.deepEqual(kept.series[0]?.values, [1, 4]);
  const skipped = aggregateRows(rows, { ...base, skipEmpty: true });
  assert.deepEqual(skipped.labels, ["a"]);
});

void test("groups become series over shared labels", () => {
  const spec = aggregateRows(
    [{ x: "a", group: "g1" }, { x: "b", group: "g2" }, { x: "a", group: "g2" }],
    base,
  );
  assert.deepEqual(spec.labels, ["a", "b"]);
  assert.deepEqual(spec.series.map((s) => [s.name, s.values]), [["g1", [1, 0]], ["g2", [1, 1]]]);
});

void test("options pass through and empty input yields an empty series", () => {
  const spec = aggregateRows([], { ...base, topN: 3, other: "Other", horizontal: true, title: "T" });
  assert.equal(spec.topN, 3);
  assert.equal(spec.other, "Other");
  assert.equal(spec.horizontal, true);
  assert.deepEqual(spec.series[0]?.values, []);
  assert.deepEqual(parseCategoryColors(["yes: #1f77b4", "bad", "no:red"]), { yes: "#1f77b4", no: "red" });
});
