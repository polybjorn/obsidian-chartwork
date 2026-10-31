import { test } from "node:test";
import assert from "node:assert/strict";
import { barHoldsLabel, formatLabel, insidePlot } from "../src/engine/labels.ts";

const area = { left: 40, right: 340, top: 30, bottom: 230 };

void test("labels group thousands like the axis ticks", () => {
  assert.equal(formatLabel(2500000, "en-US"), "2,500,000");
  assert.equal(formatLabel(2500000, "nb-NO").replace(/\s/g, " "), "2 500 000");
});

void test("labels keep the decimals the ticks would", () => {
  assert.equal(formatLabel(12345.678, "en-US"), "12,345.678");
  assert.equal(formatLabel(0.1 + 0.2, "en-US"), "0.3");
});

void test("a missing locale still formats", () => {
  assert.equal(typeof formatLabel(42, undefined), "string");
});

void test("a point past the axis range is outside the plot", () => {
  assert.equal(insidePlot(100, 10, area), false);
  assert.equal(insidePlot(100, 120, area), true);
  assert.equal(insidePlot(100, 30, area), true);
  assert.equal(insidePlot(100, 29.5, area), true);
  assert.equal(insidePlot(400, 120, area), false);
});

void test("a zero bar gets no label", () => {
  assert.equal(barHoldsLabel(0, false, 0, 12), false);
  assert.equal(barHoldsLabel(3, false, 1, 12), true);
});

void test("a stacked segment needs room for its text", () => {
  assert.equal(barHoldsLabel(3, true, -5, 14), false);
  assert.equal(barHoldsLabel(3, true, -20, 14), true);
});
