/** The box a chart that can't be drawn shows in its place. */
export function showError(el: HTMLElement, message: string): HTMLElement {
  const box = el.createDiv({ cls: "chartwork-error" });
  box.createEl("strong", { text: "Chartwork can't draw this chart" });
  box.createEl("p", { text: message });
  return box;
}

export function errorText(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
