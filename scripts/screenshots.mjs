// Renders the README and docs screenshots from docs/demo-vault in a separate
// Obsidian instance driven over the DevTools protocol. Its own --user-data-dir
// keeps it apart from the Obsidian you have open: its own vault list, settings
// and single-instance lock. Each image is the whole window as macOS draws it,
// with rounded corners and shadow, so the terminal running it needs Screen
// Recording access. Run with `npm run screenshots` (macOS).
import { execFileSync, spawn } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const OUT = join(ROOT, "docs/images");
const OBSIDIAN = process.env.OBSIDIAN_BIN ?? "/Applications/Obsidian.app/Contents/MacOS/Obsidian";
const PORT = 9333;
// The window's content size in points; a Retina screen captures it at 2x
const WINDOW = { width: 1100, height: 780 };
// The demo vault's note names are short, so the file list needs little room
const SIDEBAR = 180;
// Room under a fitted chart, so the status bar does not cover it
const FIT_MARGIN = 72;
const THEMES = { light: "moonstone", dark: "obsidian" };

const SHOTS = [
  { file: "Reading.md", name: "readme", theme: "dark", chart: ".chartwork-bases" },
  { file: "Genres.md", name: "bases-view", theme: "light", chart: ".chartwork-bases", menu: true },
  { file: "Pages read.md", name: "code-block", theme: "light", chart: ".chartwork-block", fit: true },
  { file: "Script.md", name: "script", theme: "light", chart: ".chartwork-script", script: true, fit: true },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// The source view keeps a hidden copy of each embed with a zero-size box, so
// only an element that takes up space is the one on screen
const visible = (sel) => `[...document.querySelectorAll(${JSON.stringify(sel)})]
  .find((e) => e.getBoundingClientRect().height > 0)`;

async function waitFor(check, what, timeout = 15000) {
  const end = Date.now() + timeout;
  for (;;) {
    const value = await check().catch(() => null);
    if (value) return value;
    if (Date.now() > end) throw new Error(`Timed out waiting for ${what}`);
    await sleep(250);
  }
}

async function connect() {
  const targets = await waitFor(async () => {
    const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
    return list.some((t) => t.type === "page" && t.url.startsWith("app://")) ? list : null;
  }, "the Obsidian window");
  const page = targets.find((t) => t.type === "page" && t.url.startsWith("app://"));
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r, j) => {
    ws.addEventListener("open", r, { once: true });
    ws.addEventListener("error", j, { once: true });
  });
  let seq = 0;
  const pending = new Map();
  ws.addEventListener("message", (e) => {
    const m = JSON.parse(e.data);
    if (!pending.has(m.id)) return;
    const { res, rej } = pending.get(m.id);
    pending.delete(m.id);
    if (m.error) rej(new Error(m.error.message));
    else res(m.result);
  });
  const send = (method, params = {}) =>
    new Promise((res, rej) => {
      const id = ++seq;
      pending.set(id, { res, rej });
      ws.send(JSON.stringify({ id, method, params }));
    });
  const evaluate = async (expression) => {
    const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
    return r.result.value;
  };
  return { send, evaluate, close: () => ws.close() };
}

function installPlugin(vault) {
  const plugin = join(vault, ".obsidian/plugins/chartwork");
  mkdirSync(plugin, { recursive: true });
  for (const f of ["main.js", "manifest.json", "styles.css"]) cpSync(join(ROOT, f), join(plugin, f));
}

function prepare() {
  const work = mkdtempSync(join(tmpdir(), "chartwork-shots-"));
  const vault = join(work, "vault");
  const profile = join(work, "profile");
  // A vault that lists plugins when it first opens gets a trust prompt over
  // every page, so the plugin goes in once the vault has loaded
  cpSync(join(ROOT, "docs/demo-vault"), vault, {
    recursive: true,
    filter: (src) => !src.endsWith("community-plugins.json"),
  });
  mkdirSync(profile);
  writeFileSync(join(profile, "obsidian.json"),
    JSON.stringify({ vaults: { chartworkdemo0001: { path: vault, ts: Date.now(), open: true } } }));
  return { work, vault, profile };
}

// A real pointer press: Obsidian's menus react to mousedown, which a DOM
// click() never sends
async function press(cdp, expression) {
  const at = await cdp.evaluate(`(() => {
    const r = (${expression}).getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  })()`);
  for (const type of ["mousePressed", "mouseReleased"]) {
    await cdp.send("Input.dispatchMouseEvent", { type, ...at, button: "left", clickCount: 1 });
  }
}

// The demo vault has no Dataview, so the note's dataviewjs block runs here
// against a stand-in dv, and its code is hidden the way Dataview replaces it.
// The picture comes from the very code the note holds
async function runScript(cdp, file) {
  const note = readFileSync(join(ROOT, "docs/demo-vault", file), "utf8");
  const code = note.match(/```dataviewjs\n([\s\S]*?)```/)[1];
  await cdp.evaluate(`(() => {
    const host = ${visible(".workspace-leaf.mod-active .markdown-preview-sizer")};
    host.querySelector(".chartwork-script")?.remove();
    const code = host.querySelector("code.language-dataviewjs").closest(".el-pre, pre");
    const container = document.createElement("div");
    container.className = "chartwork-script";
    code.after(container);
    code.style.display = "none";
    new Function("dv", ${JSON.stringify(code)})({ container });
  })()`);
}

// The window id macOS gives the app's normal-level window, for screencapture
function windowId(pid) {
  const jxa = `ObjC.import("CoreGraphics");
    const list = ObjC.castRefToObject($.CGWindowListCopyWindowInfo($.kCGWindowListOptionOnScreenOnly, 0));
    let id = 0;
    for (let i = 0; i < list.count; i++) {
      const w = list.objectAtIndex(i);
      const get = (k) => ObjC.unwrap(w.objectForKey(k));
      if (get("kCGWindowOwnerPID") === ${pid} && get("kCGWindowLayer") === 0) id = get("kCGWindowNumber");
    }
    id;`;
  const id = Number(execFileSync("osascript", ["-l", "JavaScript", "-e", jxa]).toString().trim());
  if (!id) throw new Error("No Obsidian window found to capture");
  return id;
}

async function resize(cdp, height) {
  await cdp.evaluate(`require("@electron/remote").getCurrentWindow().setContentSize(${WINDOW.width}, ${height})`);
  await sleep(500);
}

async function shoot(cdp, shot, id) {
  await cdp.evaluate(`app.changeTheme(${JSON.stringify(THEMES[shot.theme])})`);
  await cdp.evaluate(`(async () => {
    const leaf = app.workspace.getLeaf(false);
    await leaf.openFile(app.vault.getFileByPath(${JSON.stringify(shot.file)}), { state: { mode: "preview" } });
  })()`);
  if (shot.script) {
    await waitFor(() => cdp.evaluate(`!!${visible(".workspace-leaf.mod-active .markdown-preview-sizer")}`), shot.file);
    // The preview renders in passes and drops what it did not render itself,
    // so the chart goes in once it has settled
    await sleep(1500);
    await runScript(cdp, shot.file);
  }
  const sel = `.workspace-leaf.mod-active ${shot.chart} canvas`;
  await waitFor(() => cdp.evaluate(`!!${visible(sel)}`), `${shot.chart} in ${shot.file}`);
  if (shot.menu) {
    // The options sit behind the icon on the active view's row in the view menu
    await press(cdp, visible(".workspace-leaf.mod-active .bases-toolbar-views-menu .text-icon-button"));
    const icon = ".bases-toolbar-menu-item.mod-active .bases-toolbar-menu-item-icon";
    await waitFor(() => cdp.evaluate(`!!document.querySelector(${JSON.stringify(icon)})`), "the view menu");
    await press(cdp, `document.querySelector(${JSON.stringify(icon)})`);
    await sleep(300);
    // The menu focuses the view name, selected. Blurring it closes the menu, so
    // hide the selection and caret instead
    await cdp.evaluate(`(() => {
      const input = document.activeElement;
      input?.setSelectionRange?.(input.value.length, input.value.length);
      if (input) input.style.caretColor = "transparent";
    })()`);
  }
  // Chart.js animates in, and a theme change redraws after css-change
  await sleep(1500);
  // The theme switch redraws the chart, so the canvas can be briefly absent
  await waitFor(() => cdp.evaluate(`!!${visible(sel)}`), `${shot.chart} after the redraw`);
  // A short note leaves the lower half of the window empty, so the window ends
  // under the chart. Only the height changes, so the chart keeps its size
  if (shot.fit) {
    const bottom = await cdp.evaluate(`Math.ceil(${visible(sel)}.getBoundingClientRect().bottom)`);
    await resize(cdp, Math.min(WINDOW.height, bottom + FIT_MARGIN));
  }
  // An unfocused window draws its buttons grey
  await cdp.evaluate(`(() => {
    const remote = require("@electron/remote");
    remote.app.focus({ steal: true });
    remote.getCurrentWindow().focus();
  })()`);
  await sleep(300);
  const file = join(OUT, `${shot.name}.png`);
  execFileSync("screencapture", ["-x", "-l", String(id), file]);
  console.log(`Wrote ${file.slice(ROOT.length + 1)}`);
  if (shot.fit) await resize(cdp, WINDOW.height);
  if (shot.menu) {
    for (const type of ["keyDown", "keyUp"]) {
      await cdp.send("Input.dispatchKeyEvent", { type, key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
    }
  }
}

const { work, vault, profile } = prepare();
const app = spawn(OBSIDIAN, [`--user-data-dir=${profile}`, `--remote-debugging-port=${PORT}`], { stdio: "ignore" });
let cdp;
try {
  cdp = await connect();
  await waitFor(() => cdp.evaluate(`!!window.app?.workspace?.layoutReady`), "the vault to load");
  installPlugin(vault);
  // A new vault starts in restricted mode, with community plugins off
  await cdp.evaluate(`(async () => {
    await app.plugins.loadManifests();
    await app.plugins.setEnable(true);
    await app.plugins.enablePluginAndSave("chartwork");
  })()`);
  await waitFor(() => cdp.evaluate(`!!app.plugins.plugins.chartwork`), "Chartwork to load");
  await cdp.evaluate(`(() => {
    const win = require("@electron/remote").getCurrentWindow();
    win.setContentSize(${WINDOW.width}, ${WINDOW.height});
    win.center();
    app.workspace.leftSplit.setSize(${SIDEBAR});
  })()`);
  await sleep(500);
  const id = windowId(app.pid);
  mkdirSync(OUT, { recursive: true });
  for (const shot of SHOTS) await shoot(cdp, shot, id);
} finally {
  cdp?.close();
  app.kill();
  await sleep(500);
  rmSync(work, { recursive: true, force: true });
}
