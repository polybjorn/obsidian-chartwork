import { unknownKeyText } from "../engine/hint.ts";
import { BLOCK_KEYS } from "./parse.ts";

/**
 * Every top-level key Charts reads in a chart block, learned from its docs and
 * the key names its renderer reads. A key here that Chartwork does not read
 * gets no hint: a note written for Charts has to draw as it is.
 */
export const CHARTS_KEYS: readonly string[] = [
  "type", "labels", "series", "id", "file", "layout", "select", "width",
  "tension", "fill", "stacked", "labelColors", "transparency", "textColor", "padding",
  "beginAtZero", "legend", "legendPosition", "indexAxis", "spanGaps", "time",
  "xTitle", "yTitle", "xMin", "xMax", "xReverse", "xDisplay", "xTickDisplay", "xTickPadding",
  "yMin", "yMax", "yReverse", "yDisplay", "yTickDisplay", "yTickPadding", "rMin", "rMax",
  "bestFit", "bestFitTitle", "bestFitNumber",
];

const LABELLED = ["bar", "line", "pie", "doughnut", "radar", "polararea"];

// Keys only Chartwork reads, and the chart types that use them. Charts' own
// keys stay out, so a Charts note that sets one its chart does not use gets
// no hint either.
const ONLY_FOR: Record<string, readonly string[]> = {
  valueLabels: ["bar", "line", "pie", "doughnut", "polararea"],
  xLine: ["bar", "line"],
  yLine: ["bar", "line"],
  average: ["bar", "line"],
  cumulative: ["bar", "line"],
  height: LABELLED,
  csv: LABELLED,
};

const KIND_NAMES: Record<string, string> = { polararea: "polar area" };

function list(keys: string[]): string {
  return keys.length < 2 ? keys.join("") : `${keys.slice(0, -1).join(", ")} or ${keys[keys.length - 1]}`;
}

/**
 * The hint a block that draws shows under its chart, for keys that do
 * nothing: ones neither Chartwork nor Charts knows, and Chartwork's own keys
 * on a chart type that does not use them. Undefined when there is nothing to say.
 */
export function blockHint(input: Record<string, unknown>): string | undefined {
  const type = typeof input["type"] === "string" ? input["type"].trim().toLowerCase() : "";
  const known = [...new Set([...BLOCK_KEYS, ...CHARTS_KEYS])];
  const unknown = Object.keys(input).filter((k) => !known.includes(k));
  const unused = Object.keys(input).filter((k) => ONLY_FOR[k] && !ONLY_FOR[k].includes(type));
  const parts: string[] = [];
  if (unknown.length > 0) {
    parts.push(`Chartwork doesn't know ${list(unknown.map((k) => unknownKeyText(k, known)))}, so ${unknown.length > 1 ? "they do" : "it does"} nothing.`);
  }
  if (unused.length > 0) {
    parts.push(`A ${KIND_NAMES[type] ?? type} chart doesn't use ${list(unused)}.`);
  }
  return parts.length > 0 ? parts.join(" ") : undefined;
}
