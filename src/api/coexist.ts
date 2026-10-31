// Charts users mid-migration keep a working setup until they remove Charts.
export function shouldInstallRenderChart(existing: unknown): boolean {
  return typeof existing !== "function";
}

/** Only remove window.renderChart when it is still ours, never another plugin's. */
export function shouldRemoveRenderChart(current: unknown, ours: unknown): boolean {
  return current === ours;
}
