import type { Series } from "../engine/spec.ts";

/** Which way the series run: "rows" makes each row a series, "columns" each column. */
export const LAYOUTS = ["rows", "columns"] as const;
export type Layout = (typeof LAYOUTS)[number];

export interface Table {
  header: string[];
  rows: string[][];
}

export type TableData = { ok: true; labels: string[]; series: Series[] } | { ok: false; error: string };

// A pipe inside a cell is written \|
function cells(line: string): string[] {
  let body = line.trim();
  if (body.startsWith("|")) body = body.slice(1);
  if (body.endsWith("|") && !body.endsWith("\\|")) body = body.slice(0, -1);
  return body.split(/(?<!\\)\|/).map((c) => c.replace(/\\\|/g, "|").trim());
}

const DELIMITER = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;

/**
 * The first table in a piece of text: lines with a pipe in them, a header,
 * a delimiter row, then the body. Lines around it, such as the block id
 * (`^name`), are skipped.
 */
export function parseTable(text: string): Table | undefined {
  const lines = text.split(/\r?\n/).filter((l) => l.includes("|"));
  if (lines.length < 2 || !DELIMITER.test(lines[1] ?? "")) return undefined;
  return { header: cells(lines[0] ?? ""), rows: lines.slice(2).map(cells) };
}

/**
 * A cell's text with links reduced to what they show: `[[Note|Alias]]` is the
 * alias, `[[folder/Note#Heading]]` the note's base name (a link to a heading in
 * the same note shows the heading), `[text](url)` the text. Embeds read the same.
 */
export function stripLinks(cell: string): string {
  return cell
    .replace(/!?\[\[([^\]]*?)\]\]/g, (_m, inner: string) => {
      const [target = "", ...alias] = inner.split(/\\?\|/);
      if (alias.length) return alias.join("|").trim();
      const [path = "", heading] = target.split("#");
      const name = path.split("/").pop()?.trim() ?? "";
      return name || (heading ?? "").trim();
    })
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .trim();
}

/** A cell as a number: blank is a gap, a decimal comma and a trailing percent sign are read. */
export function cellNumber(cell: string): number | null {
  const t = stripLinks(cell).replace(/[\s]/g, "").replace(/%$/, "");
  if (!t) return null;
  const n = Number(/^-?\d+,\d+$/.test(t) ? t.replace(",", ".") : t);
  return Number.isFinite(n) ? n : null;
}

/**
 * Labels and series from a table. With "rows" the column headers are the
 * labels and each body row is a series named by its first cell; "columns"
 * turns that around. A line with no numbers in it, such as a column of notes,
 * is left out. `select` keeps the series with those names, in that order.
 */
export function tableToSeries(table: Table, layout: Layout, select?: readonly string[]): TableData {
  const grid = [table.header, ...table.rows];
  const width = Math.max(...grid.map((r) => r.length));
  const at = (r: number, c: number): string => grid[r]?.[c] ?? "";
  const byRow = layout === "rows";
  // Lines run along the series; positions are the labels
  const lineCount = byRow ? grid.length : width;
  const posCount = byRow ? width : grid.length;

  const labels: string[] = [];
  for (let p = 1; p < posCount; p++) labels.push(stripLinks(byRow ? at(0, p) : at(p, 0)));

  const all: Series[] = [];
  for (let l = 1; l < lineCount; l++) {
    const values: (number | null)[] = [];
    for (let p = 1; p < posCount; p++) values.push(cellNumber(byRow ? at(l, p) : at(p, l)));
    if (values.every((v) => v === null)) continue;
    all.push({ name: stripLinks(byRow ? at(l, 0) : at(0, l)) || `Series ${all.length + 1}`, values });
  }

  if (all.length === 0 || labels.length === 0) {
    return { ok: false, error: "The table has no numbers to draw. Put the labels in the first row and column, and numbers in the cells." };
  }
  if (!select) return { ok: true, labels, series: all };

  const series: Series[] = [];
  for (const name of select) {
    const found = all.find((s) => s.name === name);
    if (!found) {
      const have = all.map((s) => s.name).join(", ");
      return { ok: false, error: `select names "${name}", which is not a ${byRow ? "row" : "column"} of the table. It has: ${have}.` };
    }
    series.push(found);
  }
  return { ok: true, labels, series };
}
