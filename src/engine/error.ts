/** The box a chart that can't be drawn shows in its place. */
export function showError(el: HTMLElement, message: string): HTMLElement {
  const box = el.createDiv({ cls: "chartwork-error" });
  box.createEl("strong", { text: "Chartwork can't draw this chart" });
  box.createEl("p", { text: message });
  return box;
}

// Chart.js words this for its own registry, which gives a note whose chart
// drew before a script's register call no hint that order is the cause
const UNREGISTERED = /^"([^"]+)" is not a registered (controller|scale|element|plugin)\.?$/;

export function errorText(e: unknown): string {
  const message = e instanceof Error ? e.message : String(e);
  const m = UNREGISTERED.exec(message);
  if (!m) return message;
  return `The ${m[2]} "${m[1]}" is not registered. Load its add-on, or call chartwork.register, before this chart draws.`;
}
