import { execFileSync } from "child_process";
import { existsSync } from "fs";
import { join, resolve } from "path";

// The main checkout, whichever worktree runs the build, so one untracked .env
// there serves every worktree. A source copy without .git, like the community
// directory's build check, has no checkout to find and builds where it stands
function findMainCheckout() {
  try {
    const gitDir = execFileSync("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return resolve(gitDir, "..");
  } catch {
    return process.cwd();
  }
}

export const mainCheckout = findMainCheckout();

// OBSIDIAN_PLUGIN_DIR names a vault's plugin folder to copy each build into,
// for a vault that syncs to a phone, where a symlink would not follow.
export function pluginDir() {
  const env = join(mainCheckout, ".env");
  if (!process.env.OBSIDIAN_PLUGIN_DIR && existsSync(env)) process.loadEnvFile(env);
  return process.env.OBSIDIAN_PLUGIN_DIR || null;
}
