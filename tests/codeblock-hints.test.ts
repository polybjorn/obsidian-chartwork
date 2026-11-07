import { test } from "node:test";
import assert from "node:assert/strict";
import { blockHint } from "../src/codeblock/hints.ts";
import { BLOCK_KEYS } from "../src/codeblock/parse.ts";
import { checkNote } from "../src/compat/scan.ts";
import { closestKey } from "../src/engine/hint.ts";

const bar = { type: "bar", labels: ["a"], series: [{ title: "S", data: [1] }] };

void test("a block with only known keys has no hint", () => {
  assert.equal(blockHint(bar), undefined);
});

void test("a key neither plugin knows is named, with the key it may mean", () => {
  assert.equal(
    blockHint({ ...bar, valuelabels: true }),
    "Chartwork doesn't know valuelabels (did you mean valueLabels?), so it does nothing.",
  );
  assert.equal(
    blockHint({ ...bar, colour: "red", zzz: 1 }),
    "Chartwork doesn't know colour or zzz, so they do nothing.",
  );
});

void test("a Charts note shows no hint, even for the Charts keys the check command lists as ignored", () => {
  // Written out here rather than read from CHARTS_KEYS, so a key dropped from that list fails
  const charts = [
    "type", "labels", "series", "id", "file", "layout", "select", "width", "tension", "fill", "stacked",
    "labelColors", "transparency", "textColor", "padding", "beginAtZero", "legend", "legendPosition",
    "indexAxis", "spanGaps", "time", "xTitle", "yTitle", "xMin", "xMax", "xReverse", "xDisplay",
    "xTickDisplay", "xTickPadding", "yMin", "yMax", "yReverse", "yDisplay", "yTickDisplay", "yTickPadding",
    "rMin", "rMax", "bestFit", "bestFitTitle", "bestFitNumber",
  ];
  const block = Object.fromEntries(charts.map((k) => [k, 1]));
  for (const type of ["bar", "line", "pie", "doughnut", "radar", "polarArea", "scatter", "sankey"]) {
    assert.equal(blockHint({ ...block, type }), undefined, type);
  }
  const chartsOnly = charts.filter((k) => !BLOCK_KEYS.includes(k));
  assert.ok(chartsOnly.length > 0);
  const json = JSON.stringify({ ...bar, ...Object.fromEntries(chartsOnly.map((k) => [k, 1])) });
  const findings = checkNote(`\`\`\`chart\n${json}\n\`\`\``, JSON.parse);
  assert.deepEqual(findings.map((f) => f.kind), ["ignored"]);
  for (const k of chartsOnly) assert.match(findings[0]?.message ?? "", new RegExp(`\\b${k}\\b`));
});

void test("a Chartwork key on a chart type that does not use it is named", () => {
  assert.equal(blockHint({ ...bar, type: "pie", average: true, xLine: 2 }), "A pie chart doesn't use average or xLine.");
  assert.equal(blockHint({ ...bar, type: "polarArea", cumulative: true }), "A polar area chart doesn't use cumulative.");
  assert.equal(blockHint({ ...bar, type: "radar", valueLabels: true }), "A radar chart doesn't use valueLabels.");
  assert.equal(blockHint({ ...bar, type: "line", average: true, valueLabels: true }), undefined);
});

void test("a key named after an object method is only an unknown key", () => {
  assert.equal(blockHint({ ...bar, constructor: 1 }), "Chartwork doesn't know constructor, so it does nothing.");
});

void test("a key set to false on a chart type that does not use it gets no hint", () => {
  assert.equal(blockHint({ ...bar, type: "radar", valueLabels: false }), undefined);
});

void test("a guess never names a key only Charts reads", () => {
  assert.equal(blockHint({ ...bar, textcolor: "red" }), "Chartwork doesn't know textcolor, so it does nothing.");
});

void test("both kinds of hint go in one line", () => {
  assert.equal(
    blockHint({ ...bar, type: "pie", average: true, tilte: "x" }),
    "Chartwork doesn't know tilte (did you mean title?), so it does nothing. A pie chart doesn't use average.",
  );
});

void test("a guess is offered only for a close key", () => {
  assert.equal(closestKey("LEGEND", ["legend"]), "legend");
  assert.equal(closestKey("lengend", ["legend", "labels"]), "legend");
  assert.equal(closestKey("colour", ["legend", "labels"]), undefined);
  assert.equal(closestKey("idd", ["id"]), undefined);
});

void test("a time unit the date axis does not step by is named, with the ones it takes", () => {
  assert.equal(
    blockHint({ ...bar, time: "quarter" }),
    'time takes day, week, month or year, not "quarter", so the labels draw as categories.',
  );
  assert.equal(blockHint({ ...bar, type: "line", time: "Month" }), undefined);
  // Charts' key on a chart with no date axis says nothing, as other Charts keys do
  assert.equal(blockHint({ ...bar, type: "pie", time: "quarter" }), undefined);
});
