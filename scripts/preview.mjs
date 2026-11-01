import { copyFileSync, readFileSync, realpathSync } from "fs";
import { join } from "path";
import { mainCheckout as target, pluginDir } from "./plugin-dir.mjs";

if (pluginDir()) {
  console.log("The build already copied itself into OBSIDIAN_PLUGIN_DIR.");
  process.exit(0);
}

// Without OBSIDIAN_PLUGIN_DIR the vault's plugin folder is a symlink to the
// main checkout, so a build made in a git worktree is invisible to Obsidian
// until copied there.

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
