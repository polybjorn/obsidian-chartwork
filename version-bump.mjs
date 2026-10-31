import { readFileSync, writeFileSync } from "node:fs";

const targetVersion = process.env.npm_package_version;

const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
const { minAppVersion } = manifest;
manifest.version = targetVersion;
writeFileSync("manifest.json", JSON.stringify(manifest, null, 2) + "\n");

// Obsidian reads versions.json to offer an older release to an app below the
// current minAppVersion, so a row is only needed when minAppVersion moves.
const versions = JSON.parse(readFileSync("versions.json", "utf8"));
if (!Object.values(versions).includes(minAppVersion)) {
  versions[targetVersion] = minAppVersion;
  writeFileSync("versions.json", JSON.stringify(versions, null, 2) + "\n");
}
