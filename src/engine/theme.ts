import type { ChartSpec } from "./spec.ts";

export interface Theme {
  text: string;
  muted: string;
  grid: string;
  /** Slice borders, so adjacent arcs separate against the page. */
  background: string;
  font: string;
  palette: string[];
}

const PALETTE_FALLBACK: [string, string][] = [
  ["--color-blue", "#4e79a7"],
  ["--color-orange", "#f28e2b"],
  ["--color-green", "#59a14f"],
  ["--color-purple", "#b07aa1"],
  ["--color-red", "#e15759"],
  ["--color-cyan", "#76b7b2"],
  ["--color-yellow", "#edc948"],
  ["--color-pink", "#ff9da7"],
];

const VAR_REF = /^var\(\s*(--[\w-]+)\s*(?:,\s*(.+?))?\s*\)$/;

/** `var(--x, fallback)` to its parts, or null for any other colour string. */
export function parseVarRef(value: string): { name: string; fallback?: string } | null {
  const m = VAR_REF.exec(value.trim());
  if (!m?.[1]) return null;
  return m[2] === undefined ? { name: m[1] } : { name: m[1], fallback: m[2] };
}

let probe: CanvasRenderingContext2D | null | undefined;

// A canvas reports any colour it accepts back as hex or rgba(), the two forms
// withAlpha can read.
export function normalizeColor(value: string, el: HTMLElement): string {
  probe ??= el.ownerDocument.createElement("canvas").getContext("2d");
  if (!probe || !value) return value;
  probe.fillStyle = "#000000";
  probe.fillStyle = value;
  return probe.fillStyle;
}

// Code blocks and Bases views draw before their element is attached, and a
// detached element inherits no theme variables, so those read from the body,
// where Obsidian sets the theme.
function styleSource(el: HTMLElement): HTMLElement {
  return el.isConnected ? el : el.ownerDocument.body;
}

// Canvas does not resolve CSS variables, so every value is read off the element.
export function readTheme(el: HTMLElement): Theme {
  const cs = getComputedStyle(styleSource(el));
  const get = (name: string): string => cs.getPropertyValue(name).trim();
  const palette = PALETTE_FALLBACK.map(([fallbackVar, hex], i) => {
    return normalizeColor(get(`--chart-color-${i + 1}`) || get(fallbackVar) || hex, el);
  });
  return {
    text: get("--text-normal") || "#dadada",
    muted: get("--text-muted") || "#a0a0a0",
    grid: get("--background-modifier-border") || "rgba(128, 128, 128, 0.3)",
    background: get("--background-primary") || "transparent",
    font: get("--font-interface") || "sans-serif",
    palette,
  };
}

export function resolveColor(value: string, el: HTMLElement): string {
  const ref = parseVarRef(value);
  if (!ref) return normalizeColor(value, el);
  return normalizeColor(getComputedStyle(styleSource(el)).getPropertyValue(ref.name).trim() || ref.fallback || value, el);
}

/** Copy of the spec with every `var(--x)` colour turned into a concrete value. */
export function resolveSpecColors(spec: ChartSpec, el: HTMLElement): ChartSpec {
  const out: ChartSpec = {
    ...spec,
    series: spec.series.map((s) => {
      if (s.color === undefined) return s;
      const color = Array.isArray(s.color)
        ? s.color.map((c) => resolveColor(c, el))
        : resolveColor(s.color, el);
      return { ...s, color };
    }),
  };
  if (spec.categoryColors) {
    out.categoryColors = Object.fromEntries(
      Object.entries(spec.categoryColors).map(([k, v]) => [k, resolveColor(v, el)]),
    );
  }
  return out;
}
