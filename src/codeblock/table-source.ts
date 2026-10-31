import type { App } from "obsidian";
import { parseCsv, parseTable } from "./table.ts";
import type { Table } from "./table.ts";

export interface TableSource {
  /** The note that holds the table, which the chart redraws for. */
  path: string;
  table: Table;
}

export type TableLookup = { ok: true; value: TableSource } | { ok: false; error: string };

/**
 * Finds a table by its block id in the metadata cache and reads its lines from
 * the file, so nothing depends on how the note is rendered. Block ids are
 * lowercased in the cache.
 */
export async function findTable(app: App, id: string, file: string | undefined, sourcePath: string): Promise<TableLookup> {
  const note = file ? app.metadataCache.getFirstLinkpathDest(file.replace(/\.md$/, ""), sourcePath) : app.vault.getFileByPath(sourcePath);
  if (!note) return { ok: false, error: `The note "${file ?? sourcePath}" was not found.` };
  const block = app.metadataCache.getFileCache(note)?.blocks?.[id.toLowerCase()];
  if (!block) return { ok: false, error: `No block with the id "${id}" in ${note.basename}. Put ^${id} on the line right after the table.` };
  const text = await app.vault.read(note);
  const table = parseTable(text.slice(block.position.start.offset, block.position.end.offset));
  if (!table) return { ok: false, error: `The block "${id}" in ${note.basename} is not a table.` };
  return { ok: true, value: { path: note.path, table } };
}

/**
 * Finds a CSV file by vault path or file name, as a link would, from the note
 * the block sits in.
 */
export async function findCsv(app: App, csv: string, sourcePath: string): Promise<TableLookup> {
  const file = app.metadataCache.getFirstLinkpathDest(csv, sourcePath);
  if (!file) return { ok: false, error: `The file "${csv}" was not found.` };
  if (file.extension.toLowerCase() !== "csv") return { ok: false, error: `"${csv}" is not a .csv file.` };
  const table = parseCsv(await app.vault.read(file));
  if (!table) return { ok: false, error: `${file.name} is empty.` };
  return { ok: true, value: { path: file.path, table } };
}
