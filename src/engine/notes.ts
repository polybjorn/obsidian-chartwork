import type { ChartConfiguration } from "chart.js";
import type { PreparedData } from "./data.ts";

export const CLICKABLE_CLASS = "chartwork-clickable";

interface Hit {
  datasetIndex: number;
  index: number;
}

/** The notes behind the drawn elements, each once: a list property can put a note in several. */
export function notesAt(data: PreparedData, hits: Hit[]): string[] {
  const notes = hits.flatMap(({ datasetIndex, index }) => {
    const series = data.series[datasetIndex];
    const note = series?.points?.[index]?.note;
    return note === undefined ? series?.notes?.[index] ?? [] : [note];
  });
  return [...new Set(notes)];
}

/**
 * A click on an element opens its notes. A tap shows the tooltip, as hovering
 * does, so with `tapFirst` only a second tap on the same element opens them.
 */
export function withNoteClicks(
  config: ChartConfiguration,
  data: PreparedData,
  open: (notes: string[], event: MouseEvent) => void,
  tapFirst: boolean,
): ChartConfiguration {
  let tapped: string | null = null;
  return {
    ...config,
    options: {
      ...config.options,
      onHover: (_event, hits, chart) => {
        chart.canvas.classList.toggle(CLICKABLE_CLASS, notesAt(data, hits).length > 0);
      },
      onClick: (event, hits) => {
        const notes = notesAt(data, hits);
        const key = hits.map((h) => `${h.datasetIndex}:${h.index}`).join();
        const opens = !tapFirst || (notes.length > 0 && key === tapped);
        tapped = opens || notes.length === 0 ? null : key;
        if (opens && notes.length > 0 && event.native) open(notes, event.native as MouseEvent);
      },
    },
  };
}
