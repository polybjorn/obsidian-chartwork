import { BLOCK_KEYS, parseChartBlock } from "../codeblock/parse.ts";

export type FindingKind = "error" | "ignored" | "renderChart";

export interface Finding {
  /** Zero-based line of the block's opening fence, or of the call. */
  line: number;
  kind: FindingKind;
  message: string;
}

interface Fence {
  line: number;
  info: string;
  body: string[];
}

// A fence may sit in a blockquote or callout, so its prefix is kept and
// stripped from the lines inside, which keeps the YAML indentation intact
const OPEN = /^([ \t]*(?:>[ \t]?)*)(`{3,}|~{3,})(.*)$/;

function fences(text: string): Fence[] {
  const lines = text.split(/\r?\n/);
  const found: Fence[] = [];
  for (let i = 0; i < lines.length; i++) {
    const open = OPEN.exec(lines[i] ?? "");
    if (!open) continue;
    const [, prefix = "", mark = "", info = ""] = open;
    const close = new RegExp(`^${mark.charAt(0)}{${mark.length},}[ \\t]*$`);
    const body: string[] = [];
    let j = i + 1;
    for (; j < lines.length; j++) {
      const line = lines[j] ?? "";
      const inner = line.startsWith(prefix) ? line.slice(prefix.length) : line;
      if (close.test(inner)) break;
      body.push(inner);
    }
    found.push({ line: i, info: info.trim().split(/\s/)[0] ?? "", body });
    i = j;
  }
  return found;
}

function checkBlock(fence: Fence, parseYaml: (source: string) => unknown): Finding | undefined {
  const at = { line: fence.line };
  let data: unknown;
  try {
    data = parseYaml(fence.body.join("\n"));
  } catch {
    return { ...at, kind: "error", message: "Not drawn. The block is not valid YAML." };
  }
  const result = parseChartBlock(data);
  if (!result.ok) return { ...at, kind: "error", message: `Not drawn. ${result.error}` };
  const ignored = Object.keys(data as object).filter((k) => !BLOCK_KEYS.includes(k));
  if (ignored.length === 0) return undefined;
  return { ...at, kind: "ignored", message: `Drawn, but without ${ignored.join(", ")}.` };
}

/**
 * Chart blocks in a note that Chartwork cannot draw or draws without some of
 * their keys, and script calls to renderChart. A chart fence shown inside a
 * longer fence, as an example, is not a chart.
 */
export function checkNote(text: string, parseYaml: (source: string) => unknown): Finding[] {
  const findings: Finding[] = [];
  for (const fence of fences(text)) {
    if (fence.info === "chart") {
      const finding = checkBlock(fence, parseYaml);
      if (finding) findings.push(finding);
      continue;
    }
    fence.body.forEach((line, n) => {
      if (/\brenderChart\s*\(/.test(line)) {
        findings.push({
          line: fence.line + 1 + n,
          kind: "renderChart",
          message: "Calls renderChart, which draws but can't tell when the note closes. window.chartwork.render can.",
        });
      }
    });
  }
  return findings;
}

/** The findings as a Markdown checklist under a link to each note. */
export function findingsMarkdown(notes: { link: string; findings: Finding[] }[]): string {
  return notes
    .map(({ link, findings }) => [`- ${link}`, ...findings.map((f) => `  - [ ] Line ${f.line + 1}: ${f.message}`)].join("\n"))
    .join("\n");
}
