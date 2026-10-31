A full Chart.js config through `chartwork.render`: half a year of made-up pages read per day on a date axis, a 7-day average over it, a shaded holiday and a labeled target line. Needs a plugin that runs JavaScript in notes, such as Dataview.

```dataviewjs
const start = new Date(2026, 3, 1);
const days = [], pages = [];
for (let i = 0; i < 183; i++) {
  const d = new Date(start); d.setDate(d.getDate() + i);
  const day = d.toISOString().slice(0, 10);
  const weekend = d.getDay() === 0 || d.getDay() === 6;
  const holiday = day >= "2026-07-01" && day <= "2026-07-31";
  const v = 20 + i * 0.05 + (weekend ? 14 : 0) + (holiday ? 22 : 0) + Math.sin(i * 0.15) * 6 + Math.sin(i * 1.7) * 7 + Math.cos(i * 0.9) * 4;
  days.push(day); pages.push(Math.max(0, Math.round(v)));
}
const avg = pages.map((_, i) => i < 6 ? null : Math.round(pages.slice(i - 6, i + 1).reduce((a, b) => a + b, 0) / 7));
window.chartwork.render(dv.container, {
  type: "line",
  data: {labels: days, datasets: [
    {label: "Pages read", data: pages, pointRadius: 0, borderWidth: 1, borderColor: "var(--text-faint)"},
    {label: "7-day average", data: avg, pointRadius: 0, borderWidth: 3, borderColor: "var(--color-accent)"},
  ]},
  options: {
    interaction: {mode: "index", intersect: false},
    scales: {x: {type: "time", time: {unit: "month"}}, y: {beginAtZero: true}},
    plugins: {annotation: {annotations: {
      holiday: {type: "box", xMin: "2026-07-01", xMax: "2026-07-31", backgroundColor: "rgba(120, 120, 120, 0.15)", borderWidth: 0, label: {display: true, content: "Holiday", position: "start"}},
      target: {type: "line", yMin: 40, yMax: 40, borderDash: [6, 4], borderColor: "var(--color-green)", label: {display: true, content: "Target 40", position: "start"}},
    }}},
  },
}, dv.component);
```
