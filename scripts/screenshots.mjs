// Renders the README and docs screenshots from docs/demo-vault in a separate
// Obsidian instance driven over the DevTools protocol. Its own --user-data-dir
// keeps it apart from the Obsidian you have open: its own vault list, settings
// and single-instance lock. An image is the note's charts alone, two to a row,
// or with `crop`, that part of the page as drawn. Window chrome would double
// each image's height in the docs. A shot with `record` is a GIF of its steps
// instead, encoded with ffmpeg, which has to be on the PATH. Run with `npm run screenshots`, or name
// shots to render only those: `npm run screenshots -- bases-view overview`.
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
const THEMES = { light: "moonstone", dark: "obsidian" };
// Charts in a grid are drawn this wide, so their text stays readable once the
// grid is scaled down to the README's width
const GRID_LINE_WIDTH = 400;
// Space around and between charts
const GAP = 32;
// Less around a crop, which would otherwise take in the text above it
const CROP_PAD = 12;
// How long a step's own motion lasts (a toggle sliding, the options
// scrolling), captured frame by frame before the settled frame is held
const MOTION_MS = 600;
// Wide enough to stay sharp at the README's 720 on a high-density screen
const GIF_WIDTH = 1440;

const SHOTS = [
  // A .base file with its view options open, the chart moved out from under
  // them, redrawing as the options change. A smaller window keeps the text
  // readable at the docs' width
  { file: "Books.base", name: "bases-view", theme: "light", charts: 1, options: true, window: { width: 960, height: 540 },
    crop: [".bases-toolbar", ".menu.bases-toolbar-views-menu", ".chartwork-bases"],
    record: [
      { hold: 1500 },
      { scroll: "Horizontal bars", hold: 1000 },
      { toggle: "Horizontal bars", hold: 1800 },
      { select: "Chart type", value: "doughnut", hold: 2500 },
    ] },
  // The README's top image: four features, split between the themes
  { file: "Overview.md", name: "overview", theme: "light", charts: 4, split: true },
  { file: "Pages read.md", name: "code-block", theme: "light", charts: 1 },
  { file: "Script.md", name: "script", theme: "light", script: true, charts: 1 },
  { file: "Raw config.md", name: "render-chart", theme: "light", script: true, charts: 4 },
  { file: "Time series.md", name: "time-series", theme: "light", script: true, charts: 1 },
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
  // A vault with no theme of its own follows the system's at startup, which
  // can land after the first shot has set its theme
  writeFileSync(join(vault, ".obsidian/appearance.json"), JSON.stringify({ theme: THEMES.light }));
  mkdirSync(profile);
  writeFileSync(join(profile, "obsidian.json"),
    JSON.stringify({ vaults: { chartworkdemo0001: { path: vault, ts: Date.now(), open: true } } }));
  return { work, vault, profile };
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

function write(shot, base64) {
  const file = join(OUT, `${shot.name}.png`);
  writeFileSync(file, Buffer.from(base64, "base64"));
  console.log(`Wrote ${file.slice(ROOT.length + 1)}`);
}

// The charts' own canvases, two to a row on the theme's background. Each
// canvas is already at the screen's pixel density, so the image is too
const gridImage = (cdp, sel) => cdp.evaluate(`(() => {
    const charts = [...document.querySelectorAll(${JSON.stringify(sel)})]
      .filter((c) => c.getBoundingClientRect().height > 0);
    const gap = ${GAP} * window.devicePixelRatio;
    const cols = Math.min(2, charts.length);
    const rows = Math.ceil(charts.length / cols);
    const cellW = Math.max(...charts.map((c) => c.width));
    const cellH = Math.max(...charts.map((c) => c.height));
    const out = document.createElement("canvas");
    out.width = cols * cellW + (cols + 1) * gap;
    out.height = rows * cellH + (rows + 1) * gap;
    const ctx = out.getContext("2d");
    ctx.fillStyle = getComputedStyle(document.body).getPropertyValue("--background-primary");
    ctx.fillRect(0, 0, out.width, out.height);
    charts.forEach((c, i) => {
      const x = gap + (i % cols) * (cellW + gap) + (cellW - c.width) / 2;
      const y = gap + Math.floor(i / cols) * (cellH + gap) + (cellH - c.height) / 2;
      ctx.drawImage(c, x, y);
    });
    return out.toDataURL("image/png").split(",")[1];
  })()`);

async function grid(cdp, shot, sel) {
  write(shot, await gridImage(cdp, sel));
}

// The grid in the light theme above a 45 degree line and the dark one below
// it, so one image shows both themes on four different charts. Only colors
// change with the theme, so the two grids line up pixel for pixel
async function split(cdp, shot, sel) {
  const halves = [];
  for (const theme of ["light", "dark"]) {
    await setTheme(cdp, theme);
    await sleep(1500);
    halves.push(await gridImage(cdp, sel));
  }
  const png = await cdp.evaluate(`(async ([light, dark]) => {
    const load = async (b64) => {
      const img = new Image();
      img.src = "data:image/png;base64," + b64;
      await img.decode();
      return img;
    };
    const [a, b] = [await load(light), await load(dark)];
    const out = document.createElement("canvas");
    out.width = a.width;
    out.height = a.height;
    const ctx = out.getContext("2d");
    ctx.drawImage(a, 0, 0);
    const reach = a.width + a.height;
    ctx.translate(a.width / 2, a.height / 2);
    ctx.rotate(-Math.PI / 4);
    ctx.beginPath();
    ctx.rect(-reach, 0, 2 * reach, reach);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clip();
    ctx.drawImage(b, 0, 0);
    return out.toDataURL("image/png").split(",")[1];
  })(${JSON.stringify(halves)})`);
  write(shot, png);
}

// The smallest box around the crop's elements, as the page draws it
async function cropBox(cdp, shot) {
  return cdp.evaluate(`(() => {
    const rects = ${JSON.stringify(shot.crop)}
      .map((s) => [...document.querySelectorAll(s)].find((e) => e.getBoundingClientRect().height > 0))
      .filter(Boolean)
      .map((e) => e.getBoundingClientRect());
    const left = Math.min(...rects.map((r) => r.left)) - ${CROP_PAD};
    const top = Math.min(...rects.map((r) => r.top)) - ${CROP_PAD};
    const right = Math.max(...rects.map((r) => r.right)) + ${CROP_PAD};
    const bottom = Math.max(...rects.map((r) => r.bottom)) + ${CROP_PAD};
    return { x: left, y: top, width: right - left, height: bottom - top, scale: 1 };
  })()`);
}

async function crop(cdp, shot) {
  const box = await cropBox(cdp, shot);
  const { data } = await cdp.send("Page.captureScreenshot", { format: "png", clip: box, captureBeyondViewport: false });
  write(shot, data);
}

// Opens the view's options the way a click on the toolbar does, then moves
// the chart to their right so both show
async function openOptions(cdp) {
  await cdp.evaluate(`(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    document.querySelector(".workspace-leaf.mod-active .bases-toolbar-views-menu .text-icon-button").click();
    await wait(500);
    document.querySelector(".menu.bases-toolbar-views-menu .bases-toolbar-menu-item-icon").click();
    await wait(500);
    // The view name field opens focused, with its text selected
    document.activeElement?.blur();
    // It sits over the window's bottom corner, inside the crop
    document.querySelector(".status-bar").style.display = "none";
    const menu = document.querySelector(".menu.bases-toolbar-views-menu").getBoundingClientRect();
    const chart = ${visible(".workspace-leaf.mod-active .chartwork-bases")};
    chart.style.marginLeft = (menu.right - chart.getBoundingClientRect().left + ${GAP}) + "px";
  })()`);
}

async function setTheme(cdp, theme) {
  await cdp.evaluate(`app.changeTheme(${JSON.stringify(THEMES[theme])})`);
  await waitFor(() => cdp.evaluate(`document.body.classList.contains("theme-${theme}")`), `the ${theme} theme`);
}

// A row of the open view options, by its label
const optionRow = (label) => `[...document.querySelectorAll(".menu.bases-toolbar-views-menu .input-row")]
  .find((r) => r.querySelector(".input-row-label")?.textContent.trim() === ${JSON.stringify(label)})`;

async function step(cdp, s) {
  if (s.theme) return setTheme(cdp, s.theme);
  const row = s.scroll ?? s.toggle ?? s.select;
  if (!row) return;
  if (!(await cdp.evaluate(`!!${optionRow(row)}`))) throw new Error(`No view option "${row}"`);
  // The browser's own smooth scroll ends before a second capture is back, so
  // the options scroll by hand across the motion's frames
  if (s.scroll) await cdp.evaluate(`(() => {
    const row = ${optionRow(row)};
    let box = row.parentElement;
    while (box.scrollHeight <= box.clientHeight) box = box.parentElement;
    const r = row.getBoundingClientRect(), b = box.getBoundingClientRect();
    const from = box.scrollTop, by = r.top + r.height / 2 - (b.top + b.height / 2);
    const start = performance.now();
    const frame = (now) => {
      const p = Math.min(1, (now - start) / ${MOTION_MS - 100});
      box.scrollTop = from + by * (p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2);
      if (p < 1) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  })()`);
  if (s.toggle) await cdp.evaluate(`${optionRow(row)}.querySelector(".checkbox-container").click()`);
  // Obsidian reads the dropdown on its change event, as when picked by hand
  if (s.select) await cdp.evaluate(`(() => {
    const el = ${optionRow(row)}.querySelector("select");
    el.value = ${JSON.stringify(s.value)};
    el.dispatchEvent(new Event("change"));
  })()`);
}

// Each step's motion frame by frame, then its settled frame held. The chart
// itself redraws in one frame
async function record(cdp, shot, work) {
  const box = await cropBox(cdp, shot);
  const dir = join(work, "frames");
  mkdirSync(dir);
  // Two captures of an unchanged window still differ by a faint shade along
  // the options' edges, and a GIF stores each such frame in full, so a frame
  // counts as new only when enough pixels change by more than that
  await cdp.evaluate(`window.chartworkChanged = async (png) => {
    const img = new Image();
    img.src = "data:image/png;base64," + png;
    await img.decode();
    const ctx = new OffscreenCanvas(img.width, img.height).getContext("2d");
    ctx.drawImage(img, 0, 0);
    const now = ctx.getImageData(0, 0, img.width, img.height).data;
    const prev = window.chartworkFrame;
    window.chartworkFrame = now;
    if (!prev) return true;
    let changed = 0;
    for (let i = 0; i < now.length; i += 4) {
      if (Math.abs(now[i] - prev[i]) + Math.abs(now[i + 1] - prev[i + 1]) + Math.abs(now[i + 2] - prev[i + 2]) > 24) changed++;
    }
    return changed > 50;
  }`);
  const frames = [];
  const capture = async () => {
    const { data } = await cdp.send("Page.captureScreenshot", { format: "png", clip: box });
    if (!(await cdp.evaluate(`chartworkChanged(${JSON.stringify(data)})`))) return;
    const file = join(dir, `${String(frames.length).padStart(4, "0")}.png`);
    writeFileSync(file, Buffer.from(data, "base64"));
    frames.push({ file, t: Date.now() });
  };
  for (const s of shot.record) {
    await step(cdp, s);
    const start = Date.now();
    if (Object.keys(s).length > 1) while (Date.now() - start < MOTION_MS) await capture();
    await sleep(200);
    await capture();
    for (const [i, f] of frames.entries()) f.duration ??= frames[i + 1] && frames[i + 1].t - f.t;
    frames.at(-1).duration = s.hold;
  }
  const list = frames.map((f) => `file '${f.file}'\nduration ${f.duration / 1000}\n`).join("");
  writeFileSync(join(dir, "list.txt"), list);
  const file = join(OUT, `${shot.name}.gif`);
  // A flat interface needs no dithering, which would only add noise between frames
  execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i", join(dir, "list.txt"),
    "-vf", `scale=${GIF_WIDTH}:-1:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff:max_colors=128[p];` +
      "[b][p]paletteuse=dither=none:diff_mode=rectangle",
    // The concat format drops the last frame's duration, so the GIF sets it
    "-fps_mode", "vfr", "-loop", "0", "-final_delay", String(Math.round(frames.at(-1).duration / 10)), file]);
  rmSync(dir, { recursive: true });
  console.log(`Wrote ${file.slice(ROOT.length + 1)}`);
}

async function resize(cdp, shot) {
  const size = shot.window ?? WINDOW;
  await cdp.evaluate(`(() => {
    require("@electron/remote").getCurrentWindow().setContentSize(${size.width}, ${size.height});
    app.workspace.leftSplit[${JSON.stringify(shot.options ? "collapse" : "expand")}]();
  })()`);
  await sleep(500);
}

async function shoot(cdp, shot, work) {
  await resize(cdp, shot);
  await setTheme(cdp, shot.theme);
  // Obsidian's readable line length, so charts in a grid lay out at grid size
  await cdp.evaluate(`document.body.style.setProperty("--file-line-width", ${JSON.stringify(shot.charts > 1 ? `${GRID_LINE_WIDTH}px` : "")})`);
  await cdp.evaluate(`(async () => {
    const leaf = app.workspace.getLeaf(false);
    await leaf.openFile(app.vault.getFileByPath(${JSON.stringify(shot.file)}), { state: { mode: "preview" } });
  })()`);
  if (shot.script) {
    await waitFor(() => cdp.evaluate(`!!${visible(".workspace-leaf.mod-active .markdown-preview-sizer")}
      ?.querySelector("code.language-dataviewjs")`), `the script in ${shot.file}`);
    // The preview renders in passes and drops what it did not render itself,
    // so the chart goes in once it has settled
    await sleep(1500);
    await runScript(cdp, shot.file);
  }
  const sel = shot.file.endsWith(".base")
    ? ".workspace-leaf.mod-active .chartwork-bases canvas"
    : ".workspace-leaf.mod-active .markdown-reading-view canvas";
  await waitFor(() => cdp.evaluate(`[...document.querySelectorAll(${JSON.stringify(sel)})]
    .filter((c) => c.getBoundingClientRect().height > 0).length >= ${shot.charts}`), `${shot.charts} charts in ${shot.file}`);
  if (shot.options) await openOptions(cdp);
  // Chart.js animates in, and a theme change or a resize redraws it
  await sleep(1500);
  if (shot.record) await record(cdp, shot, work);
  else if (shot.split) await split(cdp, shot, sel);
  else await (shot.crop ? crop(cdp, shot) : grid(cdp, shot, sel));
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
  mkdirSync(OUT, { recursive: true });
  const only = process.argv.slice(2);
  for (const shot of SHOTS) if (only.length === 0 || only.includes(shot.name)) await shoot(cdp, shot, work);
} finally {
  cdp?.close();
  app.kill();
  await sleep(500);
  rmSync(work, { recursive: true, force: true });
}
