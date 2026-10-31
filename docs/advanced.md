# Beyond the basics

Any Chart.js config works through `window.chartwork.render`, and through `window.renderChart` for scripts written for Charts. If a chart type or option is in the [Chart.js docs](https://www.chartjs.org/docs/latest/), you can use it. The [samples](https://www.chartjs.org/docs/latest/samples/information.html) are the place to find more, and each one is a config you can paste into a script.

```js
window.chartwork.render(dv.container, {
  type: "bar",
  data: { labels: ["a", "b", "c"], datasets: [{ label: "Count", data: [3, 1, 2] }] },
}, dv.component);
```

The `docs/demo-vault/Gallery` folder holds charts like these, drawn in Obsidian.

## What Chartwork adds

Plain Chart.js draws on a canvas and knows nothing about Obsidian. Chartwork adds:

- **Theme colors.** Text, grid lines, tooltips and legend keys follow your theme wherever the config sets none, and series take the theme's colors.
- **`var(--x)` colors.** A color in the config can be a CSS variable, such as `var(--color-red)` or `var(--text-faint)`.
- **Light and dark.** Every chart redraws when you switch themes or change the text size.
- **Time axes with no setup.** `type: "time"` works with no date library installed. Chartwork reads dates through Obsidian's own moment.
- **Sankey and annotations.** The sankey chart type and the annotation plugin are bundled, so `plugins.annotation` draws lines and boxes with nothing to load.
- **Errors in the note.** A config Chart.js rejects shows its message where the chart would be.
- **Cleanup.** Pass the note's component as `owner` and the chart is destroyed when the note closes.

Niche chart types are not bundled. See Add-ons in the [script docs](script-api.md).

## Recipes

These use [Dataview](https://github.com/blacksmithgu/obsidian-dataview). Put each in a `dataviewjs` block.

### Notes created per month

Count notes by the month they were created, over the last 12 months:

```js
const months = Array.from({ length: 12 }, (_, i) => moment().subtract(11 - i, "months").format("YYYY-MM"));
const counts = Object.fromEntries(months.map((m) => [m, 0]));
for (const page of dv.pages()) {
  const month = page.file.ctime.toFormat("yyyy-MM");
  if (month in counts) counts[month]++;
}
window.chartwork.render(dv.container, {
  kind: "bar",
  labels: months,
  series: [{ name: "Notes", values: months.map((m) => counts[m]) }],
}, dv.component);
```

### A tag count as a bar

Count the tags on notes in a folder and show the ten most used:

```js
const counts = {};
for (const page of dv.pages('"Books"')) {
  for (const tag of page.file.tags) counts[tag] = (counts[tag] ?? 0) + 1;
}
window.chartwork.render(dv.container, {
  kind: "bar",
  horizontal: true,
  labels: Object.keys(counts),
  series: [{ name: "Notes", values: Object.values(counts) }],
  sort: "value",
  topN: 10,
}, dv.component);
```

### A frontmatter number over time

Plot a numeric field, here `weight`, against each note's `date`. The time axis spaces the points by date, so a gap in the notes shows as a gap:

```js
const points = dv.pages('"Journal"')
  .where((p) => p.date && typeof p.weight === "number")
  .sort((p) => p.date)
  .map((p) => ({ x: p.date.toISODate(), y: p.weight }))
  .values;
window.chartwork.render(dv.container, {
  type: "line",
  data: { datasets: [{ label: "Weight", data: points }] },
  options: { scales: { x: { type: "time", time: { unit: "month" } } } },
}, dv.component);
```

### Tasks done per week

Count completed tasks by the week of their `completion` date, which the Tasks plugin writes:

```js
const weeks = {};
for (const task of dv.pages().file.tasks.where((t) => t.completed && t.completion)) {
  const week = task.completion.startOf("week").toISODate();
  weeks[week] = (weeks[week] ?? 0) + 1;
}
const labels = Object.keys(weeks).sort();
window.chartwork.render(dv.container, {
  kind: "bar",
  labels,
  series: [{ name: "Tasks done", values: labels.map((w) => weeks[w]) }],
}, dv.component);
```

### Tasks done per day

The same count by day, for the last 30. `dateUnit` draws the labels as dates on a time axis, so a day with no tasks is a gap instead of a missing bar:

```js
const since = dv.date("today").minus({ days: 29 });
const days = {};
for (const task of dv.pages().file.tasks.where((t) => t.completed && t.completion && t.completion >= since)) {
  const day = task.completion.toISODate();
  days[day] = (days[day] ?? 0) + 1;
}
const labels = Object.keys(days).sort();
window.chartwork.render(dv.container, {
  kind: "bar",
  dateUnit: "day",
  labels,
  series: [{ name: "Tasks done", values: labels.map((d) => days[d]) }],
}, dv.component);
```

### Bars and a line on a second axis

Pages read per month as bars, and the running total as a line on its own axis on the right. List `y` before the second axis: a dataset with no `yAxisID` goes on the first y axis in `scales`.

```js
const byMonth = {};
for (const book of dv.pages('"Books"').where((p) => p.finished && p.pages)) {
  const month = book.finished.toFormat("yyyy-MM");
  byMonth[month] = (byMonth[month] ?? 0) + book.pages;
}
const labels = Object.keys(byMonth).sort();
let total = 0;
window.chartwork.render(dv.container, {
  type: "bar",
  data: {
    labels,
    datasets: [
      { label: "Pages", data: labels.map((m) => byMonth[m]) },
      { label: "Total", type: "line", yAxisID: "total", order: -1, data: labels.map((m) => (total += byMonth[m])) },
    ],
  },
  options: {
    scales: {
      y: { title: { display: true, text: "Pages" } },
      total: { position: "right", grid: { drawOnChartArea: false } },
    },
  },
}, dv.component);
```

### A moving average and a normalized series

Draw `weight` as faint dots with a seven-note moving average over them. The average is the mean of each note and the six before it, so it follows the notes, not the calendar:

```js
const notes = dv.pages('"Journal"')
  .where((p) => p.date && typeof p.weight === "number")
  .sort((p) => p.date)
  .values;
const span = 7;
const raw = notes.map((p) => ({ x: p.date.toISODate(), y: p.weight }));
const average = notes.map((p, i) => {
  const slice = notes.slice(Math.max(0, i - span + 1), i + 1);
  return { x: p.date.toISODate(), y: slice.reduce((sum, n) => sum + n.weight, 0) / slice.length };
});
window.chartwork.render(dv.container, {
  type: "line",
  data: {
    datasets: [
      { label: "Weight", data: raw, showLine: false, pointRadius: 2, borderColor: "var(--text-faint)", backgroundColor: "var(--text-faint)" },
      { label: "7-note average", data: average, pointRadius: 0, order: -1 },
    ],
  },
  options: { scales: { x: { type: "time" } } },
}, dv.component);
```

To compare two fields with different units, scale each to 0-100 of its own range so they share one axis. Here `weight` and `steps`:

```js
const notes = dv.pages('"Journal"')
  .where((p) => p.date && typeof p.weight === "number" && typeof p.steps === "number")
  .sort((p) => p.date)
  .values;
const scaled = (field) => {
  const values = notes.map((p) => p[field]);
  const min = Math.min(...values);
  const range = Math.max(...values) - min || 1;
  return notes.map((p) => ({ x: p.date.toISODate(), y: ((p[field] - min) / range) * 100 }));
};
window.chartwork.render(dv.container, {
  type: "line",
  data: {
    datasets: [
      { label: "Weight", data: scaled("weight") },
      { label: "Steps", data: scaled("steps") },
    ],
  },
  options: {
    scales: {
      x: { type: "time" },
      y: { title: { display: true, text: "Share of own range (%)" } },
    },
  },
}, dv.component);
```

### Times past midnight as hh:mm

Chart.js plots numbers, so store a time or a duration as minutes and turn the axis ticks back into `hh:mm`. This plots `bedtime`, a text field such as `23:40` or `00:30`. A time before noon counts as the next day, so 00:30 lands after 23:40 instead of far below it:

```js
const toMinutes = (text) => {
  const [h, m] = String(text).split(":").map(Number);
  const minutes = h * 60 + m;
  return minutes < 12 * 60 ? minutes + 24 * 60 : minutes;
};
const toClock = (minutes) => {
  const day = ((minutes % 1440) + 1440) % 1440;
  return String(Math.floor(day / 60)).padStart(2, "0") + ":" + String(day % 60).padStart(2, "0");
};
const points = dv.pages('"Journal"')
  .where((p) => p.date && p.bedtime)
  .sort((p) => p.date)
  .map((p) => ({ x: p.date.toISODate(), y: toMinutes(p.bedtime) }))
  .values;
window.chartwork.render(dv.container, {
  type: "line",
  data: { datasets: [{ label: "Bedtime", data: points }] },
  options: {
    scales: {
      x: { type: "time" },
      y: { ticks: { stepSize: 60, callback: (value) => toClock(value) } },
    },
    plugins: { tooltip: { callbacks: { label: (item) => toClock(item.parsed.y) } } },
  },
}, dv.component);
```

A duration, such as a `slept` field in minutes, needs the same `ticks.callback` and tooltip `label`, and no wrap at midnight: format the value as `Math.floor(value / 60)` and `value % 60`, and drop the `toMinutes` shift.

### A target band

Mark the range `weight` should stay in. The annotation plugin is bundled, so a `box` annotation from `yMin` to `yMax` needs nothing to load. It spans the full width unless you set `xMin` and `xMax`:

```js
const points = dv.pages('"Journal"')
  .where((p) => p.date && typeof p.weight === "number")
  .sort((p) => p.date)
  .map((p) => ({ x: p.date.toISODate(), y: p.weight }))
  .values;
window.chartwork.render(dv.container, {
  type: "line",
  data: { datasets: [{ label: "Weight", data: points }] },
  options: {
    scales: { x: { type: "time" } },
    plugins: {
      annotation: {
        annotations: {
          target: {
            type: "box",
            yMin: 70,
            yMax: 75,
            backgroundColor: "rgba(80, 160, 100, 0.2)",
            borderWidth: 0,
          },
        },
      },
    },
  },
}, dv.component);
```

### A calendar heatmap

A grid of days, one column per week, shaded by how many notes were created that day. It needs the `chartjs-chart-matrix` add-on, which Chartwork does not bundle or fetch. Download [`chartjs-chart-matrix@3.1.0`](https://cdn.jsdelivr.net/npm/chartjs-chart-matrix@3.1.0/dist/chartjs-chart-matrix.min.js) once, a build for Chart.js 4, and save it as `Scripts/chartjs-chart-matrix.min.js` in your vault. The first lines load it, as described under Add-ons in the [script docs](script-api.md):

```js
const module = { exports: {} };
const src = await app.vault.adapter.read("Scripts/chartjs-chart-matrix.min.js");
new Function("module", "exports", "require", src)(module, module.exports, window.chartwork.require);

const weeks = 26;
const today = dv.date("today");
const start = today.startOf("week").minus({ weeks: weeks - 1 });
const counts = {};
for (const page of dv.pages()) {
  const day = page.file.ctime.toISODate();
  counts[day] = (counts[day] ?? 0) + 1;
}
const cells = [];
for (let i = 0; i < weeks * 7; i++) {
  const day = start.plus({ days: i });
  if (day > today) break;
  cells.push({ x: Math.floor(i / 7), y: i % 7, v: counts[day.toISODate()] ?? 0, d: day.toISODate() });
}
const max = Math.max(1, ...cells.map((c) => c.v));
const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
window.chartwork.render(dv.container, {
  type: "matrix",
  data: {
    datasets: [{
      label: "Notes",
      data: cells,
      backgroundColor: (ctx) => `rgba(80, 160, 100, ${0.1 + 0.9 * (ctx.raw.v / max)})`,
      borderWidth: 0,
      width: ({ chart }) => (chart.chartArea?.width ?? 0) / weeks - 2,
      height: ({ chart }) => (chart.chartArea?.height ?? 0) / 7 - 2,
    }],
  },
  options: {
    scales: {
      x: { type: "linear", min: -0.5, max: weeks - 0.5, offset: false, ticks: { display: false }, grid: { display: false } },
      y: {
        type: "linear",
        reverse: true,
        min: -0.5,
        max: 6.5,
        offset: false,
        // Ticks would start at min, -0.5, between the rows, so put one on each row
        afterBuildTicks: (scale) => { scale.ticks = weekdays.map((_, value) => ({ value })); },
        ticks: { callback: (value) => weekdays[value] },
        grid: { display: false },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          title: (items) => items[0].raw.d,
          label: (item) => `${item.raw.v} notes`,
        },
        displayColors: false,
      },
    },
  },
}, dv.component);
```
