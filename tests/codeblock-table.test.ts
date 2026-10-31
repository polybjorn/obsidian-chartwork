import { test } from "node:test";
import assert from "node:assert/strict";
import { cellNumber, parseTable, stripLinks, tableToSeries } from "../src/codeblock/table.ts";
import type { TableData } from "../src/codeblock/table.ts";

const text = [
  "|       | Test1 | Test2 | Test3 |",
  "| ----- | ----- | ----- | ----- |",
  "| Data1 | 1     | 2     | 3.33  |",
  "| Data2 | 3     | 2     | 1     |",
  "| Data3 | 6.7   | 4     | 2     |",
  "^table",
].join("\n");

function good(r: TableData): { labels: string[]; series: { name: string; values: (number | null)[] }[] } {
  assert.ok(r.ok, r.ok ? "" : r.error);
  return r;
}

function table() {
  const t = parseTable(text);
  assert.ok(t);
  return t;
}

void test("parseTable reads header and body and skips the block id", () => {
  const t = table();
  assert.deepEqual(t.header, ["", "Test1", "Test2", "Test3"]);
  assert.equal(t.rows.length, 3);
  assert.deepEqual(t.rows[0], ["Data1", "1", "2", "3.33"]);
});

void test("parseTable handles a table without outer pipes, alignment colons and escaped pipes", () => {
  const t = parseTable("a | b\n:-- | --:\nx\\|y | 5");
  assert.deepEqual(t?.rows, [["x|y", "5"]]);
});

void test("parseTable returns nothing for text that is not a table", () => {
  assert.equal(parseTable("just a line\n^id"), undefined);
  assert.equal(parseTable("| a | b |\n| c | d |"), undefined);
});

void test("layout rows makes each row a series over the column headers", () => {
  const r = good(tableToSeries(table(), "rows"));
  assert.deepEqual(r.labels, ["Test1", "Test2", "Test3"]);
  assert.deepEqual(r.series.map((s) => s.name), ["Data1", "Data2", "Data3"]);
  assert.deepEqual(r.series[0]?.values, [1, 2, 3.33]);
});

void test("layout columns makes each column a series over the row names", () => {
  const r = good(tableToSeries(table(), "columns"));
  assert.deepEqual(r.labels, ["Data1", "Data2", "Data3"]);
  assert.deepEqual(r.series.map((s) => s.name), ["Test1", "Test2", "Test3"]);
  assert.deepEqual(r.series[0]?.values, [1, 3, 6.7]);
});

void test("select keeps the named series in the order given", () => {
  const r = good(tableToSeries(table(), "rows", ["Data3", "Data2"]));
  assert.deepEqual(r.series.map((s) => s.name), ["Data3", "Data2"]);
  const one = good(tableToSeries(table(), "columns", ["Test2"]));
  assert.deepEqual(one.series[0]?.values, [2, 2, 4]);
});

void test("select naming something the table lacks says what it has", () => {
  const r = tableToSeries(table(), "rows", ["Nope"]);
  assert.ok(!r.ok);
  assert.match(r.error, /"Nope".*row.*Data1, Data2, Data3/);
});

void test("a column without numbers is left out and blanks become gaps", () => {
  const t = parseTable("| | Note | N |\n|-|-|-|\n| a | hi | 1 |\n| b | yo | |");
  assert.ok(t);
  const r = good(tableToSeries(t, "columns"));
  assert.deepEqual(r.series.map((s) => s.name), ["N"]);
  assert.deepEqual(r.series[0]?.values, [1, null]);
});

void test("a table with no numbers is an error that says so", () => {
  const t = parseTable("| | A |\n|-|-|\n| x | foo |");
  assert.ok(t);
  const r = tableToSeries(t, "columns");
  assert.ok(!r.ok);
  assert.match(r.error, /no numbers/);
});

void test("a header-only table has no numbers either", () => {
  const t = parseTable("| | A |\n|-|-|");
  assert.ok(t);
  assert.ok(!tableToSeries(t, "rows").ok);
});

void test("cellNumber reads decimal commas, percents and spaces, and gaps otherwise", () => {
  assert.equal(cellNumber(" 3,5 "), 3.5);
  assert.equal(cellNumber("12%"), 12);
  assert.equal(cellNumber("1 000"), 1000);
  assert.equal(cellNumber("-2"), -2);
  assert.equal(cellNumber(""), null);
  assert.equal(cellNumber("n/a"), null);
});

void test("stripLinks shows the alias, note name or link text", () => {
  assert.equal(stripLinks("[[Note|Alias]]"), "Alias");
  assert.equal(stripLinks("[[Note]]"), "Note");
  assert.equal(stripLinks("[[folder/Note#Heading]]"), "Note");
  assert.equal(stripLinks("[[folder/Note#^abc|Shown]]"), "Shown");
  assert.equal(stripLinks("[[#Heading]]"), "Heading");
  assert.equal(stripLinks("![[Note]]"), "Note");
  assert.equal(stripLinks("[text](https://example.com/a_b)"), "text");
  assert.equal(stripLinks("a [[X|Y]] and [Z](u)"), "a Y and Z");
  assert.equal(stripLinks("plain"), "plain");
});

void test("a table with links in the names and a linked number", () => {
  const t = parseTable(
    ["| | [[Jan\\|January]] | [Feb](f.md) |", "| - | - | - |", "| [[Sales/Q1\\|Q1]] | [[3]] | 2 |"].join("\n"),
  );
  assert.ok(t);
  const r = good(tableToSeries(t, "rows"));
  assert.deepEqual(r.labels, ["January", "Feb"]);
  assert.equal(r.series[0]?.name, "Q1");
  assert.deepEqual(r.series[0]?.values, [3, 2]);
});
