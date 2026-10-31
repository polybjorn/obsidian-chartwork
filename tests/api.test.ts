import test from "node:test";
import assert from "node:assert/strict";
import { validateSpec } from "../src/api/validate.ts";
import { shouldInstallRenderChart, shouldRemoveRenderChart } from "../src/api/coexist.ts";

const good = () => ({
  kind: "bar",
  labels: ["a", "b"],
  series: [{ name: "n", values: [1, 2], color: ["#fff", "red"] }],
});

void test("accepts a minimal and a full spec", () => {
  assert.doesNotThrow(() => validateSpec(good()));
  assert.doesNotThrow(() =>
    validateSpec({
      ...good(), title: "t", horizontal: true, stacked: false, valueLabels: true, sort: "value",
      order: ["b"], topN: 3, other: "Other", categoryColors: { a: "red" }, valueTitle: "v", barThickness: 20,
      beginAtZero: false, tension: 0.4, legend: "bottom",
    }),
  );
});

const bad: [string, (s: Record<string, unknown>) => void, RegExp][] = [
  ["kind", (s) => { s.kind = "radar"; }, /kind must be one of/],
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
  ["title", (s) => { s.title = 3; }, /title must be a string/],
  ["horizontal", (s) => { s.horizontal = "true"; }, /horizontal must be a boolean/],
  ["sort", (s) => { s.sort = "random"; }, /sort must be one of/],
  ["topN", (s) => { s.topN = 2.5; }, /topN/],
  ["barThickness", (s) => { s.barThickness = -1; }, /barThickness/],
  ["order", (s) => { s.order = [1]; }, /order\[0\]/],
  ["categoryColors", (s) => { s.categoryColors = { a: 1 }; }, /categoryColors\.a/],
];
for (const [name, mutate, re] of bad) {
  void test(`rejects bad ${name}`, () => {
    const s: Record<string, unknown> = good();
    mutate(s);
    assert.throws(() => validateSpec(s), re);
  });
}

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
