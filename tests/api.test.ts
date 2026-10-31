import test from "node:test";
import assert from "node:assert/strict";
import { validateSpec } from "../src/api/validate.ts";
import { shouldInstallRenderChart, shouldRemoveRenderChart } from "../src/api/coexist.ts";
import { unwrapRaw } from "../src/api/raw.ts";

const good = () => ({
  kind: "bar",
  labels: ["a", "b"],
  series: [{ name: "n", values: [1, 2], color: ["#fff", "red"], stepped: "middle", hidden: false, pointRadius: 0 }],
});

void test("accepts a minimal and a full spec", () => {
  assert.doesNotThrow(() => validateSpec(good()));
  assert.doesNotThrow(() =>
    validateSpec({
      ...good(), title: "t", horizontal: true, stacked: false, valueLabels: true, sort: "value",
      order: ["b"], topN: 3, other: "Other", categoryColors: { a: "red" }, valueTitle: "v", barThickness: 20,
      beginAtZero: false, tension: 0.4, legend: "bottom", labelColors: true, spanGaps: true,
      referenceLines: { x: ["a"], y: [2, 3] }, average: true, bestFit: true, bestFitTitle: "t", bestFitNumber: 0,
      axes: { x: { min: "a", max: 1, reverse: true, display: true, ticks: false, tickPadding: 4 }, y: {}, r: { max: 5 } },
    }),
  );
});

const bad: [string, (s: Record<string, unknown>) => void, RegExp][] = [
  ["kind", (s) => { s.kind = "scatter"; }, /kind must be one of/],
  ["labels type", (s) => { s.labels = "ab"; }, /labels must be an array/],
  ["label item", (s) => { s.labels = ["a", 2]; }, /labels\[1\]/],
  ["series type", (s) => { s.series = {}; }, /series must be an array/],
  ["series item", (s) => { s.series = [null]; }, /series\[0\] must be an object/],
  ["series name", (s) => { s.series = [{ name: 1, values: [1, 2] }]; }, /series\[0\]\.name/],
  ["value NaN", (s) => { s.series = [{ name: "n", values: [1, NaN] }]; }, /values\[1\]/],
  ["tension", (s) => { s.tension = 2; }, /tension/],
  ["legend", (s) => { s.legend = "middle"; }, /legend must be/],
  ["value string", (s) => { s.series = [{ name: "n", values: ["1", 2] }]; }, /values\[0\]/],
  ["value length", (s) => { s.series = [{ name: "n", values: [1] }]; }, /1 entries but labels has 2/],
  ["color", (s) => { s.series = [{ name: "n", values: [1, 2], color: 5 }]; }, /color/],
  ["fill", (s) => { s.series = [{ name: "n", values: [1, 2], fill: "yes" }]; }, /fill/],
  ["stepped", (s) => { s.series = [{ name: "n", values: [1, 2], stepped: "up" }]; }, /stepped must be a boolean, "before"/],
  ["hidden", (s) => { s.series = [{ name: "n", values: [1, 2], hidden: 1 }]; }, /hidden must be a boolean/],
  ["pointRadius", (s) => { s.series = [{ name: "n", values: [1, 2], pointRadius: -1 }]; }, /pointRadius must be a number of 0 or more/],
  ["spanGaps", (s) => { s.spanGaps = "yes"; }, /spanGaps must be a boolean/],
  ["average", (s) => { s.average = 1; }, /average must be a boolean/],
  ["bestFitNumber", (s) => { s.bestFitNumber = 1; }, /bestFitNumber must be a series index from 0 to 0/],
  ["referenceLines", (s) => { s.referenceLines = [2]; }, /referenceLines must be an object/],
  ["referenceLines axis", (s) => { s.referenceLines = { r: [2] }; }, /unknown field referenceLines\.r/],
  ["referenceLines item", (s) => { s.referenceLines = { y: [2, null] }; }, /referenceLines\.y\[1\] must be a finite number or a label/],
  ["title", (s) => { s.title = 3; }, /title must be a string/],
  ["horizontal", (s) => { s.horizontal = "true"; }, /horizontal must be a boolean/],
  ["sort", (s) => { s.sort = "random"; }, /sort must be one of/],
  ["axes type", (s) => { s.axes = [1]; }, /axes must be an object/],
  ["axis id", (s) => { s.axes = { z: {} }; }, /unknown field axes\.z/],
  ["axis key", (s) => { s.axes = { y: { minimum: 0 } }; }, /unknown field axes\.y\.minimum/],
  ["axis bound", (s) => { s.axes = { y: { max: true } }; }, /axes\.y\.max must be a finite number or a label/],
  ["axis flag", (s) => { s.axes = { x: { reverse: "yes" } }; }, /axes\.x\.reverse must be a boolean/],
  ["topN", (s) => { s.topN = 2.5; }, /topN/],
  ["barThickness", (s) => { s.barThickness = -1; }, /barThickness/],
  ["order", (s) => { s.order = [1]; }, /order\[0\]/],
  ["categoryColors", (s) => { s.categoryColors = { a: 1 }; }, /categoryColors\.a/],
  ["top-level field", (s) => { s.colour = "red"; }, /unknown field colour/],
  ["series field", (s) => { s.series = [{ name: "n", values: [1, 2], colour: "red" }]; }, /unknown field series\[0\]\.colour/],
];
for (const [name, mutate, re] of bad) {
  void test(`rejects bad ${name}`, () => {
    const s: Record<string, unknown> = good();
    mutate(s);
    assert.throws(() => validateSpec(s), re);
  });
}

void test("returns a copy the caller can change afterwards", () => {
  const values = [1, 2];
  const color = ["#fff", "red"];
  const input = { ...good(), series: [{ name: "n", values, color }], order: ["b"], categoryColors: { a: "red" } };
  const out = validateSpec(input);
  input.labels.push("c");
  values.push(3);
  color.push("blue");
  input.order.push("a");
  input.categoryColors.a = "green";
  assert.deepEqual(out.labels, ["a", "b"]);
  assert.deepEqual(out.series, [{ name: "n", values: [1, 2], color: ["#fff", "red"] }]);
  assert.deepEqual(out.order, ["b"]);
  assert.deepEqual(out.categoryColors, { a: "red" });
});

void test("renderChart takes a config as is or wrapped with a width", () => {
  const config = { type: "bar", data: { datasets: [] } };
  assert.deepEqual(unwrapRaw(config), { config });
  assert.deepEqual(unwrapRaw({ chartOptions: config }), { config });
  assert.deepEqual(unwrapRaw({ chartOptions: config, width: "60%" }), { config, width: "60%" });
  assert.deepEqual(unwrapRaw({ chartOptions: config, width: 400 }), { config, width: "400px" });
  assert.deepEqual(unwrapRaw({ chartOptions: config, width: "" }), { config });
  assert.throws(() => unwrapRaw(null), /needs a Chart\.js config/);
  assert.throws(() => unwrapRaw({ chartOptions: 5 }), /chartOptions must be/);
});

void test("accepts null as a gap", () => {
  assert.doesNotThrow(() => validateSpec({ ...good(), series: [{ name: "n", values: [1, null] }] }));
});

void test("rejects non-objects", () => {
  for (const v of [null, undefined, 5, "x", []]) assert.throws(() => validateSpec(v), /spec must be an object/);
});

void test("yields to an existing renderChart", () => {
  assert.equal(shouldInstallRenderChart(undefined), true);
  assert.equal(shouldInstallRenderChart(() => 1), false);
});

void test("removes renderChart only when still ours", () => {
  const ours = () => 1;
  assert.equal(shouldRemoveRenderChart(ours, ours), true);
  assert.equal(shouldRemoveRenderChart(() => 2, ours), false);
  assert.equal(shouldRemoveRenderChart(undefined, ours), false);
});
