Configs written for the Charts plugin's renderChart. Needs a plugin that runs JavaScript in notes, such as Dataview.

```dataviewjs
const square = { aspectRatio: 1.25 };
// The shape carries the comparison, so the value rings stay unlabelled
const radial = { ...square, scales: { r: { ticks: { display: false } } } };

window.renderChart({
  type: "radar",
  data: {
    labels: ["Classic", "Adventure", "Mystery", "Romance", "Science fiction", "Horror"],
    datasets: [
      { label: "2025", data: [6, 2, 4, 1, 3, 2] },
      { label: "2026", data: [4, 5, 2, 3, 1, 4] },
    ],
  },
  options: radial,
}, dv.container.createDiv());

window.renderChart({
  type: "polarArea",
  data: {
    labels: ["Morning", "Commute", "Lunch", "Evening", "Night"],
    datasets: [{ label: "Hours a week", data: [3, 4, 2, 7, 5] }],
  },
  options: radial,
}, dv.container.createDiv());

window.renderChart({
  type: "line",
  data: {
    datasets: [{
      label: "Pages read",
      data: [
        { x: "2026-07-01", y: 40 }, { x: "2026-07-09", y: 85 }, { x: "2026-07-18", y: 60 },
        { x: "2026-07-27", y: 120 }, { x: "2026-08-05", y: 95 }, { x: "2026-08-14", y: 30 },
        { x: "2026-08-22", y: 70 }, { x: "2026-09-01", y: 110 }, { x: "2026-09-12", y: 140 },
        { x: "2026-09-20", y: 90 }, { x: "2026-10-02", y: 75 }, { x: "2026-10-14", y: 130 },
      ],
      cubicInterpolationMode: "monotone",
    }],
  },
  options: { ...square, scales: { x: { type: "time", time: { unit: "month" } } } },
}, dv.container.createDiv());

window.renderChart({
  type: "scatter",
  data: {
    datasets: [{
      label: "Pages by year published",
      data: [
        { x: 1813, y: 432 }, { x: 1818, y: 280 }, { x: 1847, y: 507 }, { x: 1847, y: 416 },
        { x: 1851, y: 635 }, { x: 1868, y: 759 }, { x: 1868, y: 528 }, { x: 1870, y: 426 },
        { x: 1872, y: 224 }, { x: 1883, y: 292 }, { x: 1890, y: 254 }, { x: 1892, y: 307 },
        { x: 1895, y: 118 }, { x: 1897, y: 418 }, { x: 1898, y: 287 }, { x: 1902, y: 256 },
      ],
      pointRadius: 5,
    }],
  },
  // Years, not amounts, so no thousands separator
  options: { ...square, scales: { x: { ticks: { callback: (year) => String(year) } } } },
}, dv.container.createDiv());
```
