import test from "node:test";
import assert from "node:assert/strict";
import { errorText } from "../src/engine/error.ts";

void test("an unregistered chart type points at loading its add-on", () => {
  const text = errorText(new Error('"candlestick" is not a registered controller.'));
  assert.match(text, /"candlestick" is not registered/);
  assert.match(text, /Load its add-on, or call chartwork\.register, before this chart draws/);
});

void test("scales, elements and plugins get the same hint", () => {
  for (const kind of ["scale", "element", "plugin"]) {
    assert.match(errorText(new Error(`"x" is not a registered ${kind}.`)), new RegExp(`The ${kind} "x"`));
  }
});

void test("other errors pass through", () => {
  assert.equal(errorText(new Error("boom")), "boom");
  assert.equal(errorText("plain"), "plain");
});
