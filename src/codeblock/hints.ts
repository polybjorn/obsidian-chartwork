import { unknownKeyText } from "../engine/hint.ts";
import { DATE_UNITS } from "../engine/spec.ts";
import { isOneOf } from "../engine/guards.ts";
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
  const keys = Object.keys(input);
  const unknown = keys.filter((k) => !BLOCK_KEYS.includes(k) && !CHARTS_KEYS.includes(k));
  // A note's key can be any word, constructor included, so only ONLY_FOR's own
  // keys count. False asks for nothing, so nothing goes unused.
  const unused = keys.filter((k) => Object.hasOwn(ONLY_FOR, k) && input[k] !== false && !ONLY_FOR[k]?.includes(type));
  const parts: string[] = [];
  if (unknown.length > 0) {
    // A guess at a Charts-only key would send the writer to one that does nothing here either
    parts.push(`Chartwork doesn't know ${list(unknown.map((k) => unknownKeyText(k, BLOCK_KEYS)))}, so ${unknown.length > 1 ? "they do" : "it does"} nothing.`);
  }
  if (unused.length > 0) {
    parts.push(`A ${KIND_NAMES[type] ?? type} chart doesn't use ${list(unused)}.`);
  }
  // Charts takes any Chart.js unit; Chartwork steps by the four a date axis reads
  const time = input["time"];
  if ((type === "bar" || type === "line") && typeof time === "string" && !isOneOf(DATE_UNITS, time.trim().toLowerCase())) {
    parts.push(`time takes ${list([...DATE_UNITS])}, not ${JSON.stringify(time)}, so the labels draw as categories.`);
  }
  return parts.length > 0 ? parts.join(" ") : undefined;
}
