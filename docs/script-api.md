# Script function

For numbers that have to be worked out first, call `window.chartwork.render` from any plugin that runs JavaScript in notes, such as Dataview:

```js
const counts = {};
for (const page of dv.pages('"Journal"')) {
  const mood = page.mood ?? "unknown";
  counts[mood] = (counts[mood] ?? 0) + 1;
}
window.chartwork.render(dv.container, {
  kind: "bar",
  labels: Object.keys(counts),
  series: [{ name: "Days", values: Object.values(counts) }],
  sort: "value",
}, dv.component);
```

`render(element, spec, owner)` draws into `element` and returns a handle with `update(spec)` and `destroy()`. Pass the note's component as `owner` (`dv.component` in Dataview) so the chart is removed when the note closes; without it the chart lives until the plugin unloads.

An invalid spec throws an error that names the field, such as `chartwork: series[0].values has 3 entries but labels has 4`.

## Spec

| Field | Type | What it does |
|---|---|---|
| `kind` | `"bar"`, `"line"`, `"pie"`, `"doughnut"` | Required |
| `labels` | string[] | Required. One per category |
| `series` | `{name, values, color?, fill?}[]` | Required. `values` has one number or `null` per label. `color` is one colour or one per label |
| `title` | string | Shown above the chart |
| `horizontal` | boolean | Bars run sideways |
| `stacked` | boolean | Stack the series |
| `valueLabels` | boolean | Print each value on its bar. Default on for a bar chart with one series |
| `sort` | `"none"`, `"value"`, `"label"` | Category order. Default `"none"`, as given |
| `order` | string[] | Labels to place first; the rest follow by `sort` |
| `topN` | number | Keep the N largest categories by the first series |
| `other` | string | With `topN`, add the dropped categories together under this label |
| `categoryColors` | `{label: colour}` | Colour per category, for single-series bar, pie and doughnut charts |
| `valueTitle` | string | Title for the value axis |
| `beginAtZero` | boolean | Default `true` |
| `tension` | number | Line curve from 0 to 1. Default 0.2 |
| `legend` | boolean, `"top"`, `"bottom"`, `"left"`, `"right"` | Default shown for pie and doughnut and for more than one series |
| `barThickness` | number | Pixels per bar on a horizontal chart. Default 28 |

Colours can be any CSS colour, including `var(--color-red)`. Without one, series take `--chart-color-1`, `--chart-color-2` and so on when a CSS snippet sets them, and the theme's own colours otherwise.

## Charts' `renderChart`

Scripts written for the Charts plugin call `window.renderChart(config, element)` with a raw Chart.js config. Chartwork provides the same function when Charts is not installed, so those scripts keep drawing. It draws the config as given, filling in theme colours for text and grid lines the config leaves unset. Unlike `render`, it can't tell when a note closes, so prefer `render` for new scripts.
