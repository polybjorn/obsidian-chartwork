import { formatNumber } from "chart.js/helpers";

/** Same formatter and locale as the axis ticks, so a label and its tick read alike. */
export function formatLabel(value: number, locale: string | undefined): string {
  return formatNumber(value, locale as string, {});
}

interface Area {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

// A value on the axis maximum lands exactly on the edge, so rounding must not drop it
const EDGE_TOLERANCE = 1;

/**
 * A point past the axis range is cut off by Chart.js but its label would still
 * be drawn, over the title. Dropping the label beats clipping it: a label cut
 * in half at the edge reads as a wrong number.
 */
export function insidePlot(x: number, y: number, area: Area): boolean {
  return x >= area.left - EDGE_TOLERANCE && x <= area.right + EDGE_TOLERANCE &&
    y >= area.top - EDGE_TOLERANCE && y <= area.bottom + EDGE_TOLERANCE;
}

/** A zero bar has nothing to label, and a stacked segment shorter than its text would spill into its neighbors. */
export function barHoldsLabel(value: number, stacked: boolean, segmentPx: number, textPx: number): boolean {
  if (value === 0) return false;
  return !stacked || Math.abs(segmentPx) >= textPx;
}
