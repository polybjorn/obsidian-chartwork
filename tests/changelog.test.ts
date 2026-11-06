import assert from "node:assert/strict";
import test from "node:test";
import { lacksEntry, releaseNotes } from "../scripts/changelog.ts";

const changelog = `# Changelog

## [Unreleased]

### Added

- A new chart.

## [1.2.0] - 2026-01-02

### Fixed

- An old bug.

## [1.1.0] - 2026-01-01

### Added

- The first chart.

[1.1.0]: https://example.com/1.1.0
`;

void test("a stable tag's notes are its own section", () => {
  assert.equal(releaseNotes(changelog, "1.2.0"), "### Fixed\n\n- An old bug.");
});

void test("a section's notes stop at a link reference", () => {
  assert.equal(releaseNotes(changelog, "1.1.0"), "### Added\n\n- The first chart.");
});

void test("a beta's notes are the unreleased section", () => {
  assert.equal(releaseNotes(changelog, "1.3.0-beta.1"), "### Added\n\n- A new chart.");
});

void test("a stable tag with no section, or a beta with nothing unreleased, has no notes", () => {
  assert.equal(releaseNotes(changelog, "1.3.0"), "");
  assert.equal(releaseNotes("## [Unreleased]\n\n## [1.2.0] - 2026-01-02\n\n- An old bug.\n", "1.3.0-beta.1"), "");
});

void test("a feat or fix PR changing the plugin needs a changelog entry", () => {
  assert.equal(lacksEntry("fix: split table cells", [], ["src/codeblock/table.ts", "tests/codeblock-table.test.ts"]), true);
  assert.equal(lacksEntry("feat(bases): add an option", [], ["styles.css"]), true);
  assert.equal(lacksEntry("fix: split table cells", [], ["src/codeblock/table.ts", "CHANGELOG.md"]), false);
});

void test("the no-changelog label, other PR types and other paths need no entry", () => {
  assert.equal(lacksEntry("fix: correct a hint", ["no-changelog"], ["src/engine/config.ts"]), false);
  assert.equal(lacksEntry("refactor: split a module", [], ["src/engine/config.ts"]), false);
  assert.equal(lacksEntry("feat: round the docs screenshots", [], ["docs/advanced.md", "scripts/screenshots.mjs"]), false);
});
