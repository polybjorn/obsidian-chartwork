import type { Plugin } from "obsidian";

interface PluginsHost {
  plugins?: { enabledPlugins?: Set<string> };
}

// Two processors on one language would both draw into the same block, and
// app.plugins is not public API, so a missing field means "not detected".
export function chartsEnabled(plugin: Plugin): boolean {
  const host = plugin.app as unknown as PluginsHost;
  return host.plugins?.enabledPlugins?.has("obsidian-charts") === true;
}
