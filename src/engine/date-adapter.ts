import { _adapters } from "chart.js";
import type { TimeUnit } from "chart.js";
import { moment as obsidianMoment } from "obsidian";

// The part of moment used here. Obsidian types its moment as the module
// namespace, which this compiler setup reads without the call signature, and
// moment's own types can't be imported in a plugin
interface Moment {
  isValid(): boolean;
  valueOf(): number;
  format(format: string): string;
  add(amount: number, unit: TimeUnit | "days"): Moment;
  subtract(amount: number, unit: "days"): Moment;
  diff(other: Moment, unit: TimeUnit): number;
  startOf(unit: TimeUnit | "day"): Moment;
  endOf(unit: TimeUnit): Moment;
  isoWeekday(day: number): Moment;
}
type MomentFn = ((value?: unknown, format?: string) => Moment) & { isMoment(value: unknown): boolean };
const moment = obsidianMoment as unknown as MomentFn;

// Chart.js leaves time axes to a date library it does not bundle. Obsidian
// ships moment, so raw configs with a time axis draw with no added weight.

const FORMATS: Record<TimeUnit | "datetime", string> = {
  datetime: "MMM D, YYYY, h:mm:ss a",
  millisecond: "h:mm:ss.SSS a",
  second: "h:mm:ss a",
  minute: "h:mm a",
  hour: "hA",
  day: "MMM D",
  week: "ll",
  month: "MMM YYYY",
  quarter: "[Q]Q YYYY",
  year: "YYYY",
};

function parse(value: unknown, format?: string): number | null {
  if (value === null || value === undefined) return null;
  let m: Moment;
  if (typeof value === "string") m = format ? moment(value, format) : moment(value);
  else if (typeof value === "number" || value instanceof Date || moment.isMoment(value)) m = moment(value);
  else return null;
  return m.isValid() ? m.valueOf() : null;
}

// The week starts on the given ISO weekday, 1 for Monday, at or before the time
function startOfWeek(time: number, weekday: number | boolean | undefined): number {
  const day = typeof weekday === "number" ? Math.min(Math.max(Math.trunc(weekday), 1), 7) : 1;
  const start = moment(time).startOf("day").isoWeekday(day);
  if (start.valueOf() > time) start.subtract(7, "days");
  return start.valueOf();
}

export function installDateAdapter(): void {
  _adapters._date.override({
    formats: () => FORMATS,
    parse,
    format: (time, format) => moment(time).format(format),
    add: (time, amount, unit) => moment(time).add(amount, unit).valueOf(),
    diff: (a, b, unit) => moment(a).diff(moment(b), unit),
    startOf: (time, unit, weekday) =>
      unit === "isoWeek" ? startOfWeek(time, weekday) : moment(time).startOf(unit).valueOf(),
    endOf: (time, unit) => moment(time).endOf(unit).valueOf(),
  });
}
