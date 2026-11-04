import { test } from "node:test";
import assert from "node:assert/strict";
import type { ActiveElement, Chart, ChartConfiguration, ChartEvent } from "chart.js";
import type { PreparedData } from "../src/engine/data.ts";
import { CLICKABLE_CLASS, notesAt, withNoteClicks } from "../src/engine/notes.ts";

const data: PreparedData = {
  labels: ["a", "b", "c"],
  series: [
    { name: "one", values: [2, 1, 0], notes: [["x.md", "y.md"], ["z.md"], []] },
    { name: "two", values: [1, 0, 0], notes: [["x.md"], [], []] },
  ],
};
const config: ChartConfiguration = { type: "bar", data: { datasets: [] }, options: { responsive: true } };

type Hit = Pick<ActiveElement, "datasetIndex" | "index">;

function clicker(tapFirst: boolean) {
  const opened: string[][] = [];
  const classes = new Set<string>();
  const chart = {
    canvas: { classList: { toggle: (name: string, on: boolean) => (on ? classes.add(name) : classes.delete(name)) } },
  } as unknown as Chart;
  const event = { native: {} } as ChartEvent;
  const options = withNoteClicks(config, data, (notes) => opened.push(notes), tapFirst).options;
  return {
    opened,
    classes,
    click: (hits: Hit[]) => options?.onClick?.(event, hits as ActiveElement[], chart),
    hover: (hits: Hit[]) => options?.onHover?.(event, hits as ActiveElement[], chart),
  };
}

const first = { datasetIndex: 0, index: 0 };
const second = { datasetIndex: 0, index: 1 };

void test("notesAt lists an element's notes, each once across elements", () => {
  assert.deepEqual(notesAt(data, [first]), ["x.md", "y.md"]);
  assert.deepEqual(notesAt(data, [first, { datasetIndex: 1, index: 0 }]), ["x.md", "y.md"]);
  assert.deepEqual(notesAt(data, [{ datasetIndex: 0, index: 2 }]), []);
  assert.deepEqual(notesAt(data, [{ datasetIndex: 5, index: 0 }]), []);
});

void test("notesAt reads a scatter point's own note", () => {
  const scatter: PreparedData = { labels: [], series: [{ name: "n", values: [], points: [{ x: 1, y: 2, name: "p", note: "p.md" }] }] };
  assert.deepEqual(notesAt(scatter, [{ datasetIndex: 0, index: 0 }]), ["p.md"]);
});

void test("a click opens the element's notes, and an empty one does nothing", () => {
  const c = clicker(false);
  c.click([first]);
  c.click([{ datasetIndex: 0, index: 2 }]);
  c.click([]);
  assert.deepEqual(c.opened, [["x.md", "y.md"]]);
});

void test("with tapFirst only a second tap on the same element opens", () => {
  const c = clicker(true);
  c.click([first]);
  assert.deepEqual(c.opened, []);
  c.click([first]);
  assert.deepEqual(c.opened, [["x.md", "y.md"]]);
  c.click([first]);
  assert.equal(c.opened.length, 1);
});

void test("with tapFirst a tap elsewhere starts over", () => {
  const c = clicker(true);
  c.click([first]);
  c.click([second]);
  assert.deepEqual(c.opened, []);
  c.click([first]);
  c.click([]);
  c.click([first]);
  assert.deepEqual(c.opened, []);
});

void test("the pointer shows only over an element with notes", () => {
  const c = clicker(false);
  c.hover([first]);
  assert.ok(c.classes.has(CLICKABLE_CLASS));
  c.hover([{ datasetIndex: 0, index: 2 }]);
  assert.ok(!c.classes.has(CLICKABLE_CLASS));
});

void test("the config's own options stay", () => {
  assert.equal(withNoteClicks(config, data, () => undefined, false).options?.responsive, true);
});
