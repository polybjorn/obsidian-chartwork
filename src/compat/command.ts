import { Modal, Notice, parseYaml } from "obsidian";
import type { App, Plugin, TFile } from "obsidian";
import { chartsEnabled } from "../codeblock/processor.ts";
import { checkNote } from "./scan.ts";
import type { Finding } from "./scan.ts";

interface NoteFindings {
  file: TFile;
  findings: Finding[];
}

// Local storage, not data.json, so the notice leaves the vault untouched
const NOTICE_SHOWN = "chartwork-charts-notice";

async function scanVault(app: App): Promise<NoteFindings[]> {
  const results: NoteFindings[] = [];
  for (const file of app.vault.getMarkdownFiles()) {
    const text = await app.vault.cachedRead(file);
    if (!/chart/i.test(text)) continue;
    const findings = checkNote(text, parseYaml);
    if (findings.length > 0) results.push({ file, findings });
  }
  return results.sort((a, b) => a.file.path.localeCompare(b.file.path));
}

class FindingsModal extends Modal {
  private readonly results: NoteFindings[];
  private readonly chartsOn: boolean;

  constructor(app: App, results: NoteFindings[], chartsOn: boolean) {
    super(app);
    this.results = results;
    this.chartsOn = chartsOn;
  }

  override onOpen(): void {
    this.setTitle("Chart blocks and scripts to check");
    const { contentEl } = this;
    if (this.chartsOn) {
      contentEl.createEl("p", { text: "Charts is enabled, so it draws chart blocks instead of Chartwork. Disable it and reload Obsidian to switch." });
    }
    if (this.results.length === 0) {
      contentEl.createEl("p", { text: "Every chart block draws in Chartwork, and no script calls renderChart." });
      return;
    }
    for (const { file, findings } of this.results) {
      contentEl.createEl("h4", { text: file.path });
      const list = contentEl.createEl("ul");
      for (const finding of findings) {
        const item = list.createEl("li");
        const link = item.createEl("a", { text: `Line ${finding.line + 1}`, href: "#" });
        link.addEventListener("click", (e) => {
          e.preventDefault();
          this.close();
          void this.app.workspace.getLeaf(false).openFile(file, { eState: { line: finding.line } });
        });
        item.appendText(`: ${finding.message}`);
      }
    }
  }

  override onClose(): void {
    this.contentEl.empty();
  }
}

export function registerCompat(plugin: Plugin): void {
  const { app } = plugin;
  const check = async (): Promise<void> => {
    const results = await scanVault(app);
    new FindingsModal(app, results, chartsEnabled(plugin)).open();
  };
  plugin.addCommand({
    id: "check-chart-blocks",
    name: "Check chart blocks and scripts",
    callback: check,
  });

  // Chartwork stays silent while Charts draws the blocks, so without this a
  // new install looks like it does nothing. Cleared once Charts is off, so
  // turning Charts back on shows it again
  if (!chartsEnabled(plugin)) {
    app.saveLocalStorage(NOTICE_SHOWN, null);
    return;
  }
  if (app.loadLocalStorage(NOTICE_SHOWN)) return;
  app.workspace.onLayoutReady(() => {
    // A click anywhere on a notice closes it, the button included
    const message = document.createDocumentFragment();
    message.appendText("Charts is enabled, so it keeps drawing chart blocks. To switch to Chartwork, disable Charts and reload Obsidian.");
    const button = message.createDiv({ cls: "chartwork-notice-actions" }).createEl("button", { text: "Check notes first" });
    button.addEventListener("click", () => void check());
    new Notice(message, 0);
    app.saveLocalStorage(NOTICE_SHOWN, true);
  });
}
