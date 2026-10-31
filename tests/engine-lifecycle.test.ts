import { test } from "node:test";
import assert from "node:assert/strict";
import { isGone } from "../src/engine/lifecycle.ts";

interface Fake {
  isConnected: boolean;
  parentElement: Fake | null;
  classList: string[];
}

const node = (parent: Fake | null, classes: string[] = [], isConnected = false): Fake =>
  ({ isConnected, parentElement: parent, classList: classes });
const gone = (el: Fake): boolean => isGone(el as unknown as Element);

void test("an element on screen is not gone", () => {
  assert.equal(gone(node(null, [], true)), false);
});

void test("an element under a reading view section may come back", () => {
  const section = node(null, ["el-pre"]);
  assert.equal(gone(node(node(section, ["block-language-dataviewjs"]))), false);
});

void test("an element under anything else is gone", () => {
  assert.equal(gone(node(node(null, ["cm-embed-block"]))), true);
  assert.equal(gone(node(null, ["chartwork-chart"])), true);
});
