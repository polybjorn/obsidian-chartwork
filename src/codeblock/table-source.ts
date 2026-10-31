import type { App } from "obsidian";
import { parseTable } from "./table.ts";
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
