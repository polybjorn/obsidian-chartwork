import test from "node:test";
import assert from "node:assert/strict";
import { errorText } from "../src/engine/error.ts";

void test("an unregistered chart type reads as an unknown type, with spelling and add-ons as the causes", () => {
  assert.equal(
    errorText(new Error('"candlestick" is not a registered controller.')),
    'Unknown chart type "candlestick". Check the spelling. If it comes from an add-on, load the add-on or call chartwork.register before this chart draws.',
  );
});

void test("scales are named axis types; elements and plugins keep their names", () => {
  assert.match(errorText(new Error('"x" is not a registered scale.')), /^Unknown axis type "x"\./);
  for (const kind of ["element", "plugin"]) {
    assert.match(errorText(new Error(`"x" is not a registered ${kind}.`)), new RegExp(`^Unknown ${kind} "x"\\.`));
  }
});

void test("other errors pass through", () => {
  assert.equal(errorText(new Error("boom")), "boom");
  assert.equal(errorText("plain"), "plain");
});
