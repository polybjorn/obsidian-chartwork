// Renders the README screenshots from docs/demo-vault in a separate Obsidian
// instance driven over the DevTools protocol. Its own --user-data-dir keeps it
// apart from the Obsidian you have open: its own vault list, settings and
// single-instance lock. Run with `npm run screenshots` (macOS).
import { spawn } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const OUT = join(ROOT, "docs/images");
const OBSIDIAN = process.env.OBSIDIAN_BIN ?? "/Applications/Obsidian.app/Contents/MacOS/Obsidian";
const PORT = 9333;
// 900 CSS px at 2x gives 1800 px images, sharp on high-density screens
const VIEWPORT = { width: 900, height: 1100, deviceScaleFactor: 2, mobile: false };
const THEMES = { light: "moonstone", dark: "obsidian" };

const SHOTS = [
  { file: "Genres.md", name: "theme", themes: ["light", "dark"], chart: ".chartwork-bases" },
  { file: "Reading.md", name: "bases-view", themes: ["light"], chart: ".chartwork-bases", options: true },
  { file: "Savings.md", name: "code-block", themes: ["light"], chart: ".chartwork-block" },
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

async function shoot(cdp, shot, theme) {
  await cdp.evaluate(`app.changeTheme(${JSON.stringify(THEMES[theme])})`);
  await cdp.evaluate(`(async () => {
    app.workspace.leftSplit.collapse();
    app.workspace.rightSplit.collapse();
    const leaf = app.workspace.getLeaf(false);
    await leaf.openFile(app.vault.getFileByPath(${JSON.stringify(shot.file)}), { state: { mode: "preview" } });
  })()`);
  const sel = `.workspace-leaf.mod-active ${shot.chart} canvas`;
  await waitFor(() => cdp.evaluate(`!!${visible(sel)}`), `${shot.chart} in ${shot.file}`);
  if (shot.options) {
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
  const clip = await waitFor(() => cdp.evaluate(`(() => {
    const view = document.querySelector(".workspace-leaf.mod-active .view-content");
    const canvas = ${visible(sel)};
    if (!view || !canvas) return null;
    const leaf = view.getBoundingClientRect();
    const chart = canvas.getBoundingClientRect();
    const menu = document.querySelector(".menu, .popover")?.getBoundingClientRect();
    const bottom = Math.max(chart.bottom, menu ? menu.bottom : 0) + 32;
    // Trim the right edge, where the overlay scrollbar shows
    return { x: leaf.left, y: leaf.top, width: leaf.width - 16, height: Math.min(bottom, leaf.bottom) - leaf.top, scale: 1 };
  })()`), "the chart's position");
  const { data } = await cdp.send("Page.captureScreenshot", { format: "png", clip });
  const file = join(OUT, `${shot.name}${shot.themes.length > 1 ? `-${theme}` : ""}.png`);
  writeFileSync(file, Buffer.from(data, "base64"));
  console.log(`Wrote ${file.slice(ROOT.length + 1)}`);
  if (shot.options) {
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
  await cdp.send("Emulation.setDeviceMetricsOverride", VIEWPORT);
  mkdirSync(OUT, { recursive: true });
  for (const shot of SHOTS) for (const theme of shot.themes) await shoot(cdp, shot, theme);
} finally {
  cdp?.close();
  app.kill();
  await sleep(500);
  rmSync(work, { recursive: true, force: true });
}
