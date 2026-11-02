/** The box a chart that can't be drawn shows in its place. */
export function showError(el: HTMLElement, message: string): HTMLElement {
  const box = el.createDiv({ cls: "chartwork-error" });
  box.createEl("strong", { text: "Chartwork can't draw this chart" });
  box.createEl("p", { text: message });
  return box;
}

// Chart.js words this for its own registry: "controller" and "scale" are its
// names for a chart type and an axis type, and nothing in it says that a typo
// is the likely cause, or that an add-on registered after the chart drew is
const UNREGISTERED = /^"([^"]+)" is not a registered (controller|scale|element|plugin)\.?$/;
const REGISTRY_NAMES: Record<string, string> = { controller: "chart type", scale: "axis type" };

export function errorText(e: unknown): string {
  const message = e instanceof Error ? e.message : String(e);
  const m = UNREGISTERED.exec(message);
  if (!m) return message;
  const kind = m[2] ?? "";
  return `Unknown ${REGISTRY_NAMES[kind] ?? kind} "${m[1]}". Check the spelling. If it comes from an add-on, load the add-on or call chartwork.register before this chart draws.`;
}
