import { test } from "node:test";
import assert from "node:assert/strict";
import { PRINT_PPI, printPixelRatio } from "../src/engine/print.ts";

const ppi = PRINT_PPI / 96;

void test("a chart prints at about 300 ppi from a 1x or a Retina screen", () => {
  assert.equal(printPixelRatio(1, 906, 300), ppi);
  assert.equal(printPixelRatio(2, 906, 300), ppi);
});

void test("a screen above 300 ppi keeps its own ratio", () => {
  assert.equal(printPixelRatio(4, 906, 300), 4);
});

void test("a very large chart is held to the pixel budget", () => {
  const ratio = printPixelRatio(1, 2000, 4000);
  assert.ok(ratio < ppi);
  assert.ok(2000 * 4000 * ratio * ratio <= 4096 * 4096 + 1);
});

void test("a very long chart keeps its long side within the canvas limit", () => {
  const ratio = printPixelRatio(1, 800, 10000);
  assert.ok(10000 * ratio <= 16384);
});

void test("the cap never drops below the screen's ratio", () => {
  assert.equal(printPixelRatio(2, 4000, 8000), 2);
});

void test("a chart not sized yet, or a missing screen ratio, still gets a ratio", () => {
  assert.equal(printPixelRatio(1, 0, 0), ppi);
  assert.equal(printPixelRatio(0, 906, 300), ppi);
});
