Charts built the way a real note would use them: several layers, scales and data sources in one chart. The script charts pass a full Chart.js config to `chartwork.render`. They need a plugin that runs JavaScript in notes, such as Dataview. The line above each chart says what it should show.

Combo: monthly spend as bars on the left axis, savings rate as a line on a right-hand percent axis. Hovering a month shows both values in one tooltip:

```dataviewjs
const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
window.chartwork.render(dv.container, {
  type: "bar",
  data: {
    labels: months,
    datasets: [
      {label: "Food", data: [420, 380, 450, 400, 470, 520, 610, 580, 430, 410, 440, 690], stack: "spend"},
      {label: "Transport", data: [120, 110, 150, 140, 90, 80, 60, 70, 130, 140, 150, 160], stack: "spend"},
      {label: "Fun", data: [80, 60, 120, 90, 150, 220, 300, 260, 100, 90, 110, 340], stack: "spend"},
      {label: "Savings rate", type: "line", data: [22, 25, 18, 21, 17, 12, 6, 9, 20, 23, 21, 4], yAxisID: "pct", tension: 0.3, borderWidth: 3, order: -1},
    ],
  },
  options: {
    interaction: {mode: "index", intersect: false},
    plugins: {legend: {position: "bottom"}},
    scales: {
      x: {stacked: true},
      y: {stacked: true, title: {display: true, text: "kr"}},
      pct: {position: "right", min: 0, max: 30, grid: {drawOnChartArea: false}, ticks: {callback: (v) => v + " %"}},
    },
  },
}, dv.component);
```

Time series: 180 days of a made-up daily value on a real date axis, with a 7-day moving average over it, a shaded "holiday" range and a labelled target line:

```dataviewjs
const start = new Date(2026, 3, 1);
const days = [], raw = [];
let v = 50;
for (let i = 0; i < 180; i++) {
  const d = new Date(start); d.setDate(d.getDate() + i);
  v += Math.sin(i * 1.7) * 6 + Math.cos(i * 0.31) * 3 + (i % 7 === 5 ? -8 : 1);
  v = Math.max(5, Math.min(110, v));
  days.push(d.toISOString().slice(0, 10)); raw.push(Math.round(v));
}
const avg = raw.map((_, i) => i < 6 ? null : Math.round(raw.slice(i - 6, i + 1).reduce((a, b) => a + b, 0) / 7));
window.chartwork.render(dv.container, {
  type: "line",
  data: {labels: days, datasets: [
    {label: "Daily", data: raw, pointRadius: 0, borderWidth: 1, borderColor: "var(--text-faint)"},
    {label: "7-day average", data: avg, pointRadius: 0, borderWidth: 3, borderColor: "var(--color-accent)"},
  ]},
  options: {
    interaction: {mode: "index", intersect: false},
    scales: {x: {type: "time", time: {unit: "month"}}},
    plugins: {annotation: {annotations: {
      holiday: {type: "box", xMin: "2026-07-01", xMax: "2026-07-31", backgroundColor: "rgba(120, 120, 120, 0.15)", borderWidth: 0, label: {display: true, content: "Holiday", position: "start"}},
      target: {type: "line", yMin: 80, yMax: 80, borderDash: [6, 4], borderColor: "var(--color-green)", label: {display: true, content: "Target 80", position: "end"}},
    }}},
  },
}, dv.component);
```

Bubble: three groups, x and y plus size. Bubbles near the edge stay inside the chart:

```dataviewjs
const group = (seed, n) => Array.from({length: n}, (_, i) => ({x: (seed * 13 + i * 17) % 100, y: (seed * 7 + i * 29) % 60 + 5, r: 4 + ((seed + i * 5) % 18)}));
window.chartwork.render(dv.container, {type: "bubble", data: {datasets: [
  {label: "Fiction", data: group(1, 12)},
  {label: "Non-fiction", data: group(4, 9)},
  {label: "Comics", data: group(9, 6)},
]}, options: {scales: {x: {title: {display: true, text: "Pages (x10)"}}, y: {title: {display: true, text: "Days to finish"}}}}}, dv.component);
```

Logarithmic axis: values from 1 to a million on a log scale. Ticks read as powers of ten, not a squashed line:

```dataviewjs
window.chartwork.render(dv.container, {type: "line", data: {labels: ["2019", "2020", "2021", "2022", "2023", "2024", "2025", "2026"], datasets: [
  {label: "Downloads", data: [1, 12, 140, 900, 7400, 52000, 310000, 1000000]},
  {label: "Issues", data: [1, 2, 6, 18, 40, 95, 160, 210]},
]}, options: {scales: {y: {type: "logarithmic"}}}}, dv.component);
```

Floating bars as a timeline (Gantt style): each bar runs from a start week to an end week, horizontal, with a "today" line:

```dataviewjs
window.chartwork.render(dv.container, {type: "bar", data: {labels: ["Plan", "Design", "Build", "Test", "Release", "Write-up"], datasets: [
  {label: "Weeks", data: [[0, 2], [1, 5], [4, 12], [10, 14], [14, 15], [13, 17]], backgroundColor: ["var(--color-blue)", "var(--color-purple)", "var(--color-orange)", "var(--color-yellow)", "var(--color-green)", "var(--color-cyan)"]},
]}, options: {indexAxis: "y", plugins: {legend: {display: false}, annotation: {annotations: {today: {type: "line", xMin: 9, xMax: 9, borderColor: "var(--color-red)", borderWidth: 2, label: {display: true, content: "Today", position: "start"}}}}}, scales: {x: {min: 0, max: 18, title: {display: true, text: "Week"}}}}}, dv.component);
```

Nested doughnut: two rings, outer by genre and inner by format, each with its own legend entries through hovering:

```dataviewjs
window.chartwork.render(dv.container, {type: "doughnut", data: {labels: ["Fiction", "Non-fiction", "Comics", "Poetry"], datasets: [
  {label: "Read", data: [24, 15, 8, 3]},
  {label: "Listened", data: [9, 12, 0, 1]},
]}, options: {plugins: {legend: {position: "right"}}}}, dv.component);
```

Grouped and stacked at once: two stacks per quarter (planned vs actual), each stack split by team:

```dataviewjs
const q = ["Q1", "Q2", "Q3", "Q4"];
window.chartwork.render(dv.container, {type: "bar", data: {labels: q, datasets: [
  {label: "Team A planned", data: [10, 12, 14, 12], stack: "planned"},
  {label: "Team B planned", data: [8, 9, 10, 11], stack: "planned"},
  {label: "Team A actual", data: [9, 13, 11, 15], stack: "actual"},
  {label: "Team B actual", data: [7, 10, 12, 9], stack: "actual"},
]}, options: {plugins: {legend: {position: "bottom"}}, scales: {x: {stacked: true}, y: {stacked: true}}}}, dv.component);
```

Scatter with a fitted line: 40 points and a regression line drawn as a second, line-type dataset:

```dataviewjs
const pts = Array.from({length: 40}, (_, i) => ({x: i, y: Math.round(2 + i * 0.8 + Math.sin(i * 2.3) * 6)}));
const n = pts.length, sx = pts.reduce((a, p) => a + p.x, 0), sy = pts.reduce((a, p) => a + p.y, 0);
const sxy = pts.reduce((a, p) => a + p.x * p.y, 0), sxx = pts.reduce((a, p) => a + p.x * p.x, 0);
const m = (n * sxy - sx * sy) / (n * sxx - sx * sx), b = (sy - m * sx) / n;
window.chartwork.render(dv.container, {type: "scatter", data: {datasets: [
  {label: "Measurements", data: pts},
  {label: "Fit", type: "line", data: [{x: 0, y: b}, {x: 39, y: m * 39 + b}], pointRadius: 0, borderDash: [6, 4]},
]}}, dv.component);
```

Radar with four filled series, custom point shapes and a 0 to 10 scale:

```dataviewjs
window.chartwork.render(dv.container, {type: "radar", data: {labels: ["Plot", "Prose", "Pace", "Ideas", "Ending", "Characters", "World"], datasets: [
  {label: "Book A", data: [8, 6, 7, 9, 5, 8, 9], pointStyle: "circle", fill: true},
  {label: "Book B", data: [5, 9, 4, 6, 8, 9, 3], pointStyle: "rect", fill: true},
  {label: "Book C", data: [7, 7, 9, 4, 6, 5, 6], pointStyle: "triangle", fill: true},
  {label: "Book D", data: [3, 5, 6, 8, 9, 4, 7], pointStyle: "star", pointRadius: 6, fill: true},
]}, options: {scales: {r: {min: 0, max: 10, ticks: {stepSize: 2}}}}}, dv.component);
```

Custom tooltip and tick formatting: hours as `h:mm` on the axis and in the tooltip:

```dataviewjs
const fmt = (m) => Math.floor(m / 60) + ":" + String(Math.round(m % 60)).padStart(2, "0");
window.chartwork.render(dv.container, {type: "bar", data: {labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], datasets: [
  {label: "Reading time", data: [35, 50, 20, 95, 40, 180, 135]},
]}, options: {scales: {y: {ticks: {callback: (v) => fmt(v)}}}, plugins: {tooltip: {callbacks: {label: (c) => c.dataset.label + ": " + fmt(c.parsed.y)}}}}}, dv.component);
```

From your vault: notes created per month over the last 24 months, stacked by top-level folder (the 6 biggest, the rest as Other), through `chartwork.render`:

```dataviewjs
const now = moment();
const months = Array.from({length: 24}, (_, i) => now.clone().subtract(23 - i, "months").format("YYYY-MM"));
const byFolder = {};
for (const p of dv.pages()) {
  const m = p.file.ctime.toFormat("yyyy-MM");
  if (!months.includes(m)) continue;
  const top = p.file.folder.split("/")[0] || "(root)";
  (byFolder[top] ??= Object.fromEntries(months.map((x) => [x, 0])))[m]++;
}
const ranked = Object.entries(byFolder).sort((a, b) => Object.values(b[1]).reduce((x, y) => x + y, 0) - Object.values(a[1]).reduce((x, y) => x + y, 0));
const top = ranked.slice(0, 6), rest = ranked.slice(6);
const series = top.map(([name, c]) => ({name, values: months.map((m) => c[m])}));
if (rest.length) series.push({name: "Other", values: months.map((m) => rest.reduce((a, [, c]) => a + c[m], 0))});
window.chartwork.render(dv.container, {kind: "bar", stacked: true, labels: months, series, legend: "bottom", valueTitle: "Notes"}, dv.component);
```

A bigger sankey: income split into spending categories, then sub-categories, with fixed colors for the sources:

```chart
type: sankey
series:
  - data: [[Salary, 32000, Budget], [Side work, 6000, Budget], [Budget, 12000, Housing], [Budget, 6500, Food], [Budget, 3500, Transport], [Budget, 4000, Fun], [Budget, 12000, Savings], [Housing, 9000, Rent], [Housing, 3000, Power], [Food, 5000, Groceries], [Food, 1500, Eating out], [Fun, 2500, Travel], [Fun, 1500, Hobbies], [Savings, 8000, Funds], [Savings, 4000, Buffer]]
    colorFrom:
      Salary: var(--color-green)
      Side work: var(--color-cyan)
```

Filled, stacked area: three series stacked as areas, with an average line per series:

```chart
type: line
stacked: true
fill: true
average: true
tension: 0.4
labels: [Jan, Feb, Mar, Apr, May, Jun, Jul, Aug, Sep, Oct, Nov, Dec]
series:
  - title: Books
    data: [4, 5, 3, 6, 7, 5, 9, 8, 4, 5, 6, 8]
  - title: Articles
    data: [12, 9, 14, 11, 10, 8, 6, 7, 13, 15, 12, 10]
  - title: Podcasts
    data: [6, 7, 5, 8, 9, 11, 12, 10, 7, 6, 8, 9]
```
