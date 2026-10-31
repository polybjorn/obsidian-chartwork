import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

interface Manifest {
  id: string;
  version: string;
  minAppVersion: string;
  description: string;
}

function read<T>(file: string): T {
  return JSON.parse(readFileSync(new URL(`../${file}`, import.meta.url), "utf8")) as T;
}

const manifest = read<Manifest>("manifest.json");
const pkg = read<{ version: string }>("package.json");
const versions = read<Record<string, string>>("versions.json");

void test("manifest, package and versions.json agree", () => {
  assert.equal(manifest.version, pkg.version);
  assert.ok(Object.values(versions).includes(manifest.minAppVersion));
});

// The community directory review rejects these, so catch them before a release.
void test("manifest follows the directory's naming rules", () => {
  assert.doesNotMatch(manifest.id, /obsidian/i);
  assert.doesNotMatch(manifest.description, /obsidian|this plugin/i);
  assert.match(manifest.description, /\.$/);
});
