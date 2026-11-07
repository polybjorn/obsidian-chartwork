import { test } from "node:test";
import assert from "node:assert/strict";
import { aggregateRows, valueLabelsOption, bucketLabel, dateOf, noteEntries, parseCategoryColors, propertyRows, scatterSpec, xLabels, type AggregateOptions } from "../src/bases/aggregate.ts";

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

void test("cumulative is set for bar and line only", () => {
  const rows = [{ x: "a" }, { x: "b" }];
  assert.equal(aggregateRows(rows, { ...base, cumulative: true }).cumulative, true);
  assert.equal(aggregateRows(rows, { ...base, kind: "pie", cumulative: true }).cumulative, undefined);
  assert.equal(aggregateRows(rows, base).cumulative, undefined);
});

void test("stacked is set for bar and line only", () => {
  const rows = [{ x: "a" }, { x: "b" }];
  assert.equal(aggregateRows(rows, { ...base, stacked: true }).stacked, true);
  assert.equal(aggregateRows(rows, { ...base, kind: "line", stacked: true }).stacked, true);
  assert.equal(aggregateRows(rows, { ...base, kind: "doughnut", stacked: true }).stacked, undefined);
  assert.equal(aggregateRows(rows, base).stacked, undefined);
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

void test("one series per property, named by group when grouped, in property order", () => {
  const notes = [
    { x: "Mon", values: [null, 3] },
    { x: "Mon", values: [80, 5] },
    { x: "Tue", values: [81, ""] },
  ];
  const names = ["Weight", "Minutes"];
  const rows = notes.flatMap((n) => propertyRows(n.x, n.values, names, undefined, false));
  const spec = aggregateRows(rows, { ...base, aggregation: "sum", seriesOrder: names });
  assert.deepEqual(spec.series.map((s) => s.name), ["Weight", "Minutes"]);
  assert.deepEqual(spec.series.map((s) => s.values), [[80, 81], [8, 0]]);
  const counted = notes.flatMap((n) => propertyRows(n.x, n.values, names, undefined, true));
  assert.deepEqual(aggregateRows(counted, { ...base, seriesOrder: names }).series.map((s) => s.values), [[1, 1], [2, 0]]);
  assert.deepEqual(propertyRows("a", [1, 2], names, "Gym", false).map((r) => r.group), ["Gym: Weight", "Gym: Minutes"]);
});

void test("value axis options land on y, or on x when horizontal", () => {
  const rows = [{ x: "a" }, { x: "b" }];
  const up = aggregateRows(rows, { ...base, min: 2, max: 9, beginAtZero: false, average: true });
  assert.deepEqual(up.axes, { y: { min: 2, max: 9 } });
  assert.equal(up.beginAtZero, false);
  assert.equal(up.average, true);
  const side = aggregateRows(rows, { ...base, horizontal: true, min: 2 });
  assert.deepEqual(side.axes, { x: { min: 2 } });
  assert.equal(aggregateRows(rows, base).axes, undefined);
});

void test("tension is for lines, and pies take no value axis options", () => {
  const rows = [{ x: "a" }];
  assert.equal(aggregateRows(rows, { ...base, kind: "line", tension: 0.5 }).tension, 0.5);
  assert.equal(aggregateRows(rows, { ...base, tension: 0.5 }).tension, undefined);
  const pie = aggregateRows(rows, { ...base, kind: "pie", min: 1, average: true, beginAtZero: false });
  assert.equal(pie.axes, undefined);
  assert.equal(pie.average, undefined);
  assert.equal(pie.beginAtZero, undefined);
});

void test("scatter makes one point per note and skips notes missing x or y", () => {
  const spec = scatterSpec([
    { name: "Alpha", x: 1, y: 2 },
    { name: "Beta", x: "3,5", y: "4" },
    { name: "Gamma", x: 5, y: null },
    { name: "Delta", x: "n/a", y: 1 },
  ]);
  assert.equal(spec.kind, "scatter");
  assert.deepEqual(spec.series[0]?.points, [
    { x: 1, y: 2, name: "Alpha" },
    { x: 3.5, y: 4, name: "Beta" },
  ]);
});

void test("scatter scales point radius linearly between 3 and 15 over the size range", () => {
  const spec = scatterSpec([
    { name: "a", x: 0, y: 0, size: 10 },
    { name: "b", x: 1, y: 1, size: 20 },
    { name: "c", x: 2, y: 2, size: 30 },
    { name: "d", x: 3, y: 3 },
  ], { sized: true });
  assert.deepEqual(spec.series[0]?.points?.map((p) => p.radius), [3, 9, 15, 9]);
});

void test("scatter gives a middle radius when every size is equal, and none without a size property", () => {
  const same = scatterSpec([{ name: "a", x: 0, y: 0, size: 4 }, { name: "b", x: 1, y: 1, size: 4 }], { sized: true });
  assert.deepEqual(same.series[0]?.points?.map((p) => p.radius), [9, 9]);
  const unsized = scatterSpec([{ name: "a", x: 0, y: 0, size: 4 }]);
  assert.equal(unsized.series[0]?.points?.[0]?.radius, undefined);
});

void test("scatter keeps each size value and its title for the tooltip", () => {
  const spec = scatterSpec([
    { name: "a", x: 0, y: 0, size: 10 },
    { name: "b", x: 1, y: 1, size: "not a number" },
    { name: "c", x: 2, y: 2 },
  ], { sized: true, sizeTitle: "Rating" });
  assert.deepEqual(spec.series[0]?.points?.map((p) => p.size), [10, undefined, undefined]);
  assert.equal(spec.sizeTitle, "Rating");
  const unsized = scatterSpec([{ name: "a", x: 0, y: 0, size: 10 }]);
  assert.equal(unsized.series[0]?.points?.[0]?.size, undefined);
});

void test("scatter ignores the size of a note it skips, and splits groups into series", () => {
  const spec = scatterSpec([
    { name: "a", x: 0, y: 0, size: 1, group: "Gym" },
    { name: "skipped", x: null, y: 0, size: 1000, group: "Gym" },
    { name: "b", x: 1, y: 1, size: 3, group: "Run" },
  ], { sized: true, xTitle: "Hours", yTitle: "Score" });
  assert.deepEqual(spec.series.map((s) => s.name), ["Gym", "Run"]);
  assert.deepEqual(spec.series.map((s) => s.points?.[0]?.radius), [3, 15]);
  assert.equal(spec.xTitle, "Hours");
  assert.equal(spec.valueTitle, "Score");
});

void test("an average keeps one decimal more than its most precise input", () => {
  const pages = [{ x: "a", y: 412 }, { x: "a", y: 500 }, { x: "a", y: 443 }, { x: "b", y: 0.1 }, { x: "b", y: 0.2 }];
  assert.deepEqual(aggregateRows(pages, { ...base, aggregation: "average" }).series[0]?.values, [451.7, 0.15]);
  const hours = [{ x: "a", y: 1.25 }, { x: "a", y: "2" }, { x: "a", y: 1 }];
  assert.deepEqual(aggregateRows(hours, { ...base, aggregation: "average" }).series[0]?.values, [1.417]);
  const sum = aggregateRows(pages, { ...base, aggregation: "sum" });
  assert.deepEqual(sum.series[0]?.values, [1355, 0.1 + 0.2]);
});

void test("the Value labels option reaches the spec, and Automatic leaves it to the engine", () => {
  const rows = [{ x: "a" }, { x: "b" }];
  const opts = { aggregation: "count", kind: "bar" } as const;
  assert.equal(aggregateRows(rows, { ...opts, valueLabels: true }).valueLabels, true);
  assert.equal(aggregateRows(rows, { ...opts, valueLabels: false }).valueLabels, false);
  assert.equal("valueLabels" in aggregateRows(rows, opts), false);
});

void test("the Value labels option reads the dropdown and a chart block's booleans", () => {
  assert.equal(valueLabelsOption("on"), true);
  assert.equal(valueLabelsOption(true), true);
  assert.equal(valueLabelsOption("off"), false);
  assert.equal(valueLabelsOption(false), false);
  assert.equal(valueLabelsOption("auto"), undefined);
  assert.equal(valueLabelsOption(undefined), undefined);
});

void test("each value keeps the paths of the notes behind it", () => {
  const rows = [{ x: "a", note: "1.md" }, { x: "b", note: "2.md" }, { x: "a", note: "3.md" }];
  assert.deepEqual(aggregateRows(rows, base).series[0]?.notes, [["1.md", "3.md"], ["2.md"]]);
});

void test("rows with no note add no notes to the series", () => {
  assert.ok(!("notes" in (aggregateRows([{ x: "a" }], base).series[0] ?? {})));
});

void test("a note listing a category twice sits in it once", () => {
  assert.deepEqual(aggregateRows([{ x: ["a", "a"], note: "1.md" }], base).series[0]?.notes, [["1.md"]]);
});

void test("a note skipped for having no number is not behind the value", () => {
  const rows = [{ x: "a", y: 1, note: "1.md" }, { x: "a", y: "n/a", note: "2.md" }];
  assert.deepEqual(aggregateRows(rows, { ...base, aggregation: "sum" }).series[0]?.notes, [["1.md"]]);
});

void test("an empty date bucket has no notes, and each group keeps its own", () => {
  const rows = [
    { x: "2026-01-05", group: "g", note: "1.md" },
    { x: "2026-03-02", group: "g", note: "2.md" },
    { x: "2026-03-09", group: "h", note: "3.md" },
  ];
  const spec = aggregateRows(rows, { ...base, dateUnit: "month" });
  assert.deepEqual(spec.series[0]?.notes, [["1.md"], [], ["2.md"]]);
  assert.deepEqual(spec.series[1]?.notes, [[], [], ["3.md"]]);
});

void test("property rows carry their note", () => {
  const rows = propertyRows("a", [1], ["p"], undefined, false, "1.md");
  assert.equal(rows[0]?.note, "1.md");
});

void test("a scatter point keeps its note", () => {
  const spec = scatterSpec([{ name: "n", note: "dir/n.md", x: 1, y: 2 }]);
  assert.equal(spec.series[0]?.points?.[0]?.note, "dir/n.md");
});

void test("noteEntries sorts by name and shows the folder of a shared name", () => {
  assert.deepEqual(noteEntries(["b/Zed.md", "a/index.md", "b/index.md", "Art.pdf"]), [
    { path: "a/index.md", title: "a/index" },
    { path: "Art.pdf", title: "Art.pdf" },
    { path: "b/index.md", title: "b/index" },
    { path: "b/Zed.md", title: "Zed" },
  ]);
});

void test("group colors pin the named series and leave the rest to the palette", () => {
  const rows = [{ x: "1990s", group: "Watched" }, { x: "1990s", group: "Not watched" }, { x: "2000s", group: "(none)" }];
  const spec = aggregateRows(rows, { ...base, groupColors: { Watched: "var(--color-green)", "(none)": "gray", Missing: "red" } });
  assert.deepEqual(spec.series.map((s) => s.color), ["var(--color-green)", undefined, "gray"]);
  const line = aggregateRows(rows, { ...base, kind: "line", groupColors: { "Not watched": "blue" } });
  assert.deepEqual(line.series.map((s) => s.color), [undefined, "blue", undefined]);
});

void test("group colors that match no series change nothing", () => {
  const rows = [{ x: "a", group: "One" }, { x: "a", group: "Two" }];
  assert.deepEqual(aggregateRows(rows, { ...base, groupColors: { Three: "red" } }), aggregateRows(rows, base));
});

void test("a single-series chart, or a pie, ignores group colors", () => {
  const single = aggregateRows([{ x: "a" }], { ...base, seriesName: "Books", groupColors: { Books: "red" } });
  assert.equal(single.series[0]?.color, undefined);
  const oneGroup = aggregateRows([{ x: "a", group: "One" }], { ...base, groupColors: { One: "red" } });
  assert.equal(oneGroup.series[0]?.color, undefined);
  const pie = aggregateRows([{ x: "a", group: "One" }, { x: "a", group: "Two" }], { ...base, kind: "pie", groupColors: { One: "red" } });
  assert.deepEqual(pie.series.map((s) => s.color), [undefined, undefined]);
});

void test("scatter groups take group colors", () => {
  const spec = scatterSpec([
    { name: "a", x: 1, y: 1, group: "Watched" },
    { name: "b", x: 2, y: 2, group: "Not watched" },
  ], { groupColors: { Watched: "green" } });
  assert.deepEqual(spec.series.map((s) => s.color), ["green", undefined]);
  const ungrouped = scatterSpec([{ name: "a", x: 1, y: 1 }], { groupColors: { Notes: "green" } });
  assert.equal(ungrouped.series[0]?.color, undefined);
});
