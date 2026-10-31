export interface ChartworkSettings {
  /** Series colours tried before the CSS variables. Empty leaves the theme in charge. */
  seriesColors: string[];
}

/** One colour per line; blank lines are dropped so a trailing newline adds nothing. */
export function parseColorList(text: string): string[] {
  return text.split("\n").map((line) => line.trim()).filter((line) => line !== "");
}

// data.json is hand-editable, so anything unexpected falls back to the
// default instead of throwing in onload.
export function readSettings(raw: unknown): ChartworkSettings {
  const colors = (raw as { seriesColors?: unknown } | null)?.seriesColors;
  if (!Array.isArray(colors)) return { seriesColors: [] };
  return {
    seriesColors: colors
      .filter((c): c is string => typeof c === "string")
      .map((c) => c.trim())
      .filter((c) => c !== ""),
  };
}
