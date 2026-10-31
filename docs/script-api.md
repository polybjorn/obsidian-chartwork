# Script function

Call `window.chartwork.render` from a plugin that runs JavaScript in notes, such as Dataview:

```js
window.chartwork.render(dv.container, {
  kind: "pie",
  labels: ["Read", "Reading", "To read"],
  series: [{ name: "Books", values: [7, 2, 5] }],
}, dv.component);
```

<img src="images/script.png" width="560" alt="The pie chart this script draws">

A script usually counts first, here this month's notes by tag:

```js
const counts = {};
for (const page of dv.pages().where((p) => p.file.ctime >= dv.date("som"))) {
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

`render(element, spec, owner)` draws into `element` and returns a handle with `update(spec)` and `destroy()`. Pass the note's component as `owner` (`dv.component` in Dataview) so the chart goes when the note closes.

A bad or unknown field throws an error naming it, such as `chartwork: series[0].values has 3 entries but labels has 4`; `update` checks the same way. The spec is copied, so changing it afterwards does nothing.

`window.chartwork.version` tells a script which fields it can use.

## Spec

| Field | Type | What it does |
|---|---|---|
| `kind` | `"bar"`, `"line"`, `"pie"`, `"doughnut"`, `"radar"`, `"polarArea"` | Required. A radar takes its spokes from `labels` and draws one shape per series. A polar area draws one segment per label, sized by the first series |
| `labels` | string[] | Required. One per category |
| `series` | `{name, values, color?, fill?}[]` | Required. `values` has one number or `null` per label. `color` is one colour or one per label. `fill` fills the area under a line; a radar is filled unless `fill` is `false` |
| `title` | string | Shown above the chart |
| `horizontal` | boolean | Bars run sideways |
| `stacked` | boolean | Stack the series |
| `valueLabels` | boolean | Print each value on its bar. Default on for single-series bars |
| `sort` | `"none"`, `"value"`, `"label"` | Category order. Default `"none"`, as given |
| `order` | string[] | Labels to place first; the rest follow by `sort` |
| `topN` | number | Keep the N largest categories by the first series |
| `other` | string | With `topN`, sums the dropped categories under this label |
| `categoryColors` | `{label: colour}` | Colour per category, for single-series bar, pie, doughnut and polar area charts |
| `valueTitle` | string | Title for the value axis |
| `beginAtZero` | boolean | Value axis or radar scale starts at zero. Default `true` |
| `tension` | number | Line curve from 0 to 1. Default 0.2 |
| `legend` | boolean, `"top"`, `"bottom"`, `"left"`, `"right"` | Default shown for pie, doughnut, polar area and multi-series charts |
| `barThickness` | number | Pixels per bar on a horizontal chart. Default 28 |

Colours can be any CSS colour, including `var(--color-red)`. Without one, series take the colours listed under Series colors in Chartwork's settings, then `--chart-color-1`, `--chart-color-2` and on from a CSS snippet, else the theme's colours.

## Charts' `renderChart`

Scripts for the Charts plugin call `window.renderChart(config, element)` with a raw Chart.js config, or `{chartOptions: config, width: "60%"}`. Without Charts installed, Chartwork provides it: any Chart.js chart type, time axes included, with theme colours and square legend keys wherever the config sets none. A failing config shows its error and returns `null`. Annotations draw, in the text colour unless they set their own. Charts' sankey plugin is not bundled. New scripts should use `render`, which knows when a note closes.

<img src="images/render-chart.png" width="560" alt="Four charts from renderChart: a radar of genres by year, a polar area of reading hours by time of day, a line of pages read on a time axis and a scatter of pages by year published">
