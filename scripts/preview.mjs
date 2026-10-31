import { copyFileSync, readFileSync, realpathSync } from "fs";
import { execFileSync } from "child_process";
import { join, resolve } from "path";

// The vault's plugin folder is a symlink to the main checkout, so a build made
// in a git worktree is invisible to Obsidian until copied there.
const commonDir = execFileSync(
  "git",
  ["rev-parse", "--path-format=absolute", "--git-common-dir"],
  { encoding: "utf8" },
).trim();
const target = resolve(commonDir, "..");

if (realpathSync(target) === realpathSync(".")) {
  console.log("Built in the main checkout, so Obsidian already sees it.");
  process.exit(0);
}

copyFileSync("main.js", join(target, "main.js"));
console.log(`Copied main.js to ${target}`);

// styles.css is tracked, so copying it dirties the main checkout; only a
// branch that changed it needs it copied.
const css = "styles.css";
if (!readFileSync(css).equals(readFileSync(join(target, css)))) {
  copyFileSync(css, join(target, css));
  console.log(`Copied ${css} too. Undo with \`git restore ${css}\` in the main checkout.`);
}
