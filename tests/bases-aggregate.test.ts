import { test } from "node:test";
import assert from "node:assert/strict";
import { aggregateRows, bucketLabel, dateOf, parseCategoryColors, xLabels, type AggregateOptions } from "../src/bases/aggregate.ts";

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

void test("min and max per category; an empty bucket has no average or extreme", () => {
  const rows = [{ x: "a", y: 2, group: "g" }, { x: "a", y: 5, group: "g" }, { x: "b", y: 1, group: "h" }];
  assert.deepEqual(aggregateRows(rows, { ...base, aggregation: "min" }).series[0]?.values, [2, null]);
  assert.deepEqual(aggregateRows(rows, { ...base, aggregation: "max" }).series[0]?.values, [5, null]);
  assert.deepEqual(aggregateRows(rows, { ...base, aggregation: "average" }).series[1]?.values, [null, 1]);
  assert.deepEqual(aggregateRows(rows, { ...base, aggregation: "sum" }).series[1]?.values, [0, 1]);
  assert.equal(aggregateRows(rows, { ...base, aggregation: "max" }).series[0]?.name, "g");
});

void test("dateOf reads ISO dates, datetimes, Dates and daily-note links, and nothing else", () => {
  assert.equal(dateOf("2026-03-02")?.getDate(), 2);
  assert.equal(dateOf("2026-03-02T23:40")?.getDate(), 2);
  assert.equal(dateOf("2026-03-02T23:40:00Z")?.getDate(), 2);
  assert.equal(dateOf("[[2026-03-02]]")?.getMonth(), 2);
  assert.equal(dateOf(new Date(2026, 2, 2, 23, 40))?.getHours(), 0);
  assert.equal(dateOf("2026-02-31"), null);
  assert.equal(dateOf("March 2"), null);
  assert.equal(dateOf(20260302), null);
});

void test("dates bucket by unit onto a time axis, weeks from Monday, empty buckets count zero", () => {
  const rows = [{ x: "2026-03-04" }, { x: "2026-03-01" }, { x: "2026-03-16T08:00" }, { x: null }];
  const week = aggregateRows(rows, { ...base, dateUnit: "week", sort: "value", topN: 1 });
  assert.deepEqual(week.labels, ["2026-02-23", "2026-03-02", "2026-03-09", "2026-03-16"]);
  assert.deepEqual(week.series[0]?.values, [1, 1, 0, 1]);
  assert.equal(week.dateUnit, "week");
  assert.equal(week.topN, undefined);
  const month = aggregateRows(rows, { ...base, dateUnit: "month", kind: "line" });
  assert.deepEqual(month.labels, ["2026-03-01"]);
  assert.deepEqual(month.series[0]?.values, [3]);
});

void test("an average over dates leaves empty buckets out instead of drawing zero", () => {
  const rows = [{ x: "2026-01-03", y: 80 }, { x: "2026-01-03", y: 82 }, { x: "2026-01-09", y: 79 }];
  const spec = aggregateRows(rows, { ...base, aggregation: "average", kind: "line", dateUnit: "day" });
  assert.deepEqual(spec.labels, ["2026-01-03", "2026-01-09"]);
  assert.deepEqual(spec.series[0]?.values, [81, 79]);
});

void test("dates only count when every category is one, and a pie gets readable labels", () => {
  const mixed = aggregateRows([{ x: "2026-01-03" }, { x: "soon" }], { ...base, dateUnit: "day" });
  assert.deepEqual(mixed.labels, ["2026-01-03", "soon"]);
  assert.equal(mixed.dateUnit, undefined);
  const pie = aggregateRows([{ x: "2026-01-03" }, { x: "2026-02-10" }], { ...base, kind: "pie", dateUnit: "month" });
  assert.deepEqual(pie.labels, ["2026-01", "2026-02"]);
  assert.equal(pie.dateUnit, undefined);
  assert.equal(bucketLabel("2025-12-29", "week"), "2026-W01");
  assert.equal(bucketLabel("2026-12-28", "week"), "2026-W53");
});
