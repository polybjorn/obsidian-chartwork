import { test } from "node:test";
import assert from "node:assert/strict";
import { parseColorList, readSettings } from "../src/settings.ts";

const EMPTY = { seriesColors: [] };

void test("a color list is one entry per non-blank line", () => {
  assert.deepEqual(parseColorList("#4e79a7\n  var(--color-orange) \n\nrgb(1, 2, 3)\n"), [
    "#4e79a7",
    "var(--color-orange)",
    "rgb(1, 2, 3)",
  ]);
  assert.deepEqual(parseColorList(""), []);
});

void test("settings default to an empty list", () => {
  assert.deepEqual(readSettings(null), EMPTY);
  assert.deepEqual(readSettings({}), EMPTY);
  assert.deepEqual(readSettings({ seriesColors: "red" }), EMPTY);
});

void test("saved settings keep only usable strings", () => {
  assert.deepEqual(readSettings({ seriesColors: ["#fff", 3, " ", " red "] }), { seriesColors: ["#fff", "red"] });
});

void test("the default list is not shared between reads", () => {
  readSettings(null).seriesColors.push("red");
  assert.deepEqual(readSettings(null).seriesColors, []);
});
