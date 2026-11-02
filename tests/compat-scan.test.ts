import { test } from "node:test";
import assert from "node:assert/strict";
import { checkNote, findingsMarkdown } from "../src/compat/scan.ts";

// YAML is a superset of JSON, so JSON blocks stand in for Obsidian's parseYaml
const check = (text: string) => checkNote(text, JSON.parse);

const good = '{"type": "bar", "labels": ["a"], "series": [{"title": "S", "data": [1]}]}';

void test("a block that draws as written has no findings", () => {
  assert.deepEqual(check(`Intro\n\n\`\`\`chart\n${good}\n\`\`\`\n`), []);
});

void test("an unsupported type is reported at its opening fence", () => {
  const findings = check('# Note\n\n```chart\n{"type": "sankey", "labels": ["a"], "series": []}\n```\n');
  assert.equal(findings.length, 1);
  assert.equal(findings[0]?.kind, "error");
  assert.equal(findings[0]?.line, 2);
  assert.match(findings[0]?.message ?? "", /sankey/);
});

void test("keys the parser does not read are listed", () => {
  const block = '{"type": "bar", "labels": ["a"], "series": [{"title": "S", "data": [1]}], "madeUpKey": true}';
  const findings = check(`\`\`\`chart\n${block}\n\`\`\``);
  assert.deepEqual(findings.map((f) => [f.kind, f.message]), [["ignored", "Drawn, but without madeUpKey."]]);
});

void test("a block that is not valid YAML is an error", () => {
  const finding = check("```chart\n{type: \n```")[0];
  assert.equal(finding?.kind, "error");
  assert.match(finding?.message ?? "", /^Not drawn\. The block's formatting is broken\./);
});

void test("a chart fence shown inside a longer fence is an example, not a chart", () => {
  assert.deepEqual(check('````markdown\n```chart\n{"type": "sankey"}\n```\n````\n'), []);
});

void test("a block in a callout is read without the quote markers", () => {
  const findings = check('> [!note]\n> ```chart\n> {"type": "scatter"}\n> ```\n');
  assert.equal(findings[0]?.line, 1);
  assert.match(findings[0]?.message ?? "", /scatter/);
});

void test("tilde fences count", () => {
  assert.equal(check('~~~chart\n{"type": "sankey"}\n~~~\n').length, 1);
});

void test("renderChart is reported inside a script block, not in prose", () => {
  const text = "Mentions renderChart(config) in prose.\n\n```dataviewjs\nconst c = {};\nwindow.renderChart(c, this.container);\n```\n";
  const findings = check(text);
  assert.deepEqual(findings.map((f) => [f.kind, f.line]), [["renderChart", 4]]);
});

void test("findings copy as a checklist under each note's link, with one-based lines", () => {
  const md = findingsMarkdown([
    { link: "[[A]]", findings: [{ line: 2, kind: "error", message: "Not drawn." }, { line: 9, kind: "renderChart", message: "Calls renderChart." }] },
    { link: "[[B]]", findings: [{ line: 0, kind: "ignored", message: "Drawn, but without x." }] },
  ]);
  assert.equal(md, "- [[A]]\n  - [ ] Line 3: Not drawn.\n  - [ ] Line 10: Calls renderChart.\n- [[B]]\n  - [ ] Line 1: Drawn, but without x.");
});
