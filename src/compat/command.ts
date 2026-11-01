import { Modal, Notice, Setting, parseYaml } from "obsidian";
import type { App, Plugin, TFile } from "obsidian";
import { errorText } from "../engine/index.ts";
import { chartsEnabled } from "./charts.ts";
import { checkNote, findingsMarkdown } from "./scan.ts";
import type { Finding } from "./scan.ts";

interface NoteFindings {
  file: TFile;
  findings: Finding[];
}

// Local storage, not data.json, so the notice leaves the vault untouched
const NOTICE_SHOWN = "chartwork-charts-notice";

interface ScanResult {
  notes: NoteFindings[];
  /** Notes that could not be read, so their blocks went unchecked. */
  unread: string[];
}

async function scanVault(app: App): Promise<ScanResult> {
  const notes: NoteFindings[] = [];
  const unread: string[] = [];
  for (const file of app.vault.getMarkdownFiles()) {
    // One unreadable note, such as one deleted mid-scan, would otherwise end
    // the check with nothing shown
    try {
      const text = await app.vault.cachedRead(file);
      if (!/chart/i.test(text)) continue;
      const findings = checkNote(text, parseYaml);
      if (findings.length > 0) notes.push({ file, findings });
    } catch {
      unread.push(file.path);
    }
  }
  notes.sort((a, b) => a.file.path.localeCompare(b.file.path));
  return { notes, unread: unread.sort() };
}

// Settings has no public close, and the list opens over it from the settings
// tab's button, so a line link would land behind it
function closeSettings(app: App): void {
  const setting = (app as App & { setting?: { close?: () => void } }).setting;
  if (typeof setting?.close === "function") setting.close();
}

class FindingsModal extends Modal {
  private readonly scan: ScanResult;
  private readonly chartsOn: boolean;

  constructor(app: App, scan: ScanResult, chartsOn: boolean) {
    super(app);
    this.scan = scan;
    this.chartsOn = chartsOn;
  }

  override onOpen(): void {
    this.setTitle("Chart blocks and scripts to check");
    this.modalEl.addClass("chartwork-findings");
    const { contentEl } = this;
    if (this.chartsOn) {
      contentEl.createEl("p", { text: "The Charts plugin is enabled, so it draws chart blocks instead of Chartwork. Disable it and reload Obsidian to switch." });
    }
    const { notes, unread } = this.scan;
    if (unread.length > 0) {
      contentEl.createEl("p", { text: `These notes could not be read, so they were not checked: ${unread.join(", ")}.` });
    }
    if (notes.length === 0) {
      if (unread.length === 0) contentEl.createEl("p", { text: "Every chart block draws in Chartwork, and no script calls renderChart." });
      return;
    }
    for (const { file, findings } of notes) {
      contentEl.createEl("h4", { text: file.path });
      const list = contentEl.createEl("ul");
      for (const finding of findings) {
        const item = list.createEl("li");
        const link = item.createEl("a", { text: `Line ${finding.line + 1}`, href: "#" });
        link.addEventListener("click", (e) => {
          e.preventDefault();
          this.close();
          closeSettings(this.app);
          void this.app.workspace.getLeaf(false).openFile(file, { eState: { line: finding.line } });
        });
        item.appendText(`: ${finding.message}`);
      }
    }
    new Setting(contentEl).addButton((button) => button
      .setButtonText("Copy as Markdown")
      .onClick(() => void this.copy()));
  }

  private async copy(): Promise<void> {
    const markdown = findingsMarkdown(this.scan.notes.map(({ file, findings }) => ({
      link: this.app.fileManager.generateMarkdownLink(file, ""),
      findings,
    })));
    try {
      await navigator.clipboard.writeText(markdown);
      new Notice("Copied the list as Markdown.");
    } catch (e) {
      new Notice(`Chartwork could not copy the list. ${errorText(e)}`);
    }
  }

  override onClose(): void {
    this.contentEl.empty();
  }
}

/** Registers the check command and returns it, for the settings tab's button. */
export function registerCompat(plugin: Plugin): () => Promise<void> {
  const { app } = plugin;
  const check = async (): Promise<void> => {
    try {
      new FindingsModal(app, await scanVault(app), chartsEnabled(plugin)).open();
    } catch (e) {
      new Notice(`Chartwork could not check the notes. ${errorText(e)}`);
    }
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
    return check;
  }
  if (app.loadLocalStorage(NOTICE_SHOWN)) return check;
  app.workspace.onLayoutReady(() => {
    // A click anywhere on a notice closes it, the button included
    const message = createFragment();
    message.appendText("The Charts plugin is enabled, so it keeps drawing chart blocks. To switch to Chartwork, disable Charts and reload Obsidian.");
    const button = message.createDiv({ cls: "chartwork-notice-actions" }).createEl("button", { text: "Check notes first" });
    button.addEventListener("click", () => void check());
    new Notice(message, 0);
    app.saveLocalStorage(NOTICE_SHOWN, true);
  });
  return check;
}
