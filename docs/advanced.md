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
