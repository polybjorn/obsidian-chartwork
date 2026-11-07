/** Pixels per inch a chart aims for in a printed or exported PDF. */
export const PRINT_PPI = 300;

/** CSS pixels per inch, which a pixel ratio of 1 prints at. */
const CSS_PPI = 96;

// A canvas this size takes 64 MB, and a note can hold many charts. Chromium
// refuses a canvas side past 32767 pixels, well before this area binds on any
// chart shape that is not a thin strip.
const MAX_PIXELS = 4096 * 4096;
const MAX_SIDE = 16384;

/**
 * The Chart.js `devicePixelRatio` for a chart printed at `width` x `height`
 * CSS pixels: about 300 ppi, held to a pixel budget, and never below the
 * screen's own ratio. A chart not sized yet gets the uncapped ratio.
 */
export function printPixelRatio(screen: number, width: number, height: number): number {
  const floor = screen > 0 ? screen : 1;
  const target = Math.max(floor, PRINT_PPI / CSS_PPI);
  if (!(width > 0 && height > 0)) return target;
  const fit = Math.min(Math.sqrt(MAX_PIXELS / (width * height)), MAX_SIDE / Math.max(width, height));
  return Math.max(floor, Math.min(target, fit));
}
