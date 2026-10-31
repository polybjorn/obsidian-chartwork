# Chart code block

For numbers that live in no note, type them into a `chart` code block. The format is the one the Charts plugin uses, so existing blocks draw without changes.

````markdown
```chart
type: line
labels: [Jan, Feb, Mar, Apr]
series:
  - title: Savings
    data: [120, 180, null, 260]
  - title: Spending
    data: [90, 110, 95, 140]
beginAtZero: false
```
````

`type`, `labels` and `series` are required. Each series has a `title` and a `data` list with one value per label; `null` leaves a gap.

| Key | Applies to | What it does |
|---|---|---|
| `type` | all | `bar`, `line`, `pie` or `doughnut` |
| `indexAxis: y` | bar, line | Horizontal bars |
| `stacked: true` | bar, line | Stack the series |
| `fill: true` | line | Fill the area under each line |
| `tension` | line | Curve, 0 for straight segments. Default 0.2 |
| `beginAtZero` | bar, line | Start the value axis at zero. Default `true` |
| `xTitle` / `yTitle` | bar, line | Title for the value axis (`xTitle` when the bars are horizontal) |
| `legend` | all | `false` hides the legend, `true` shows it |
| `legendPosition` | all | `top`, `bottom`, `left` or `right` |
| `width` | all | Chart width, as CSS (`60%`) or pixels (`400`) |

Colours come from the theme. A bar chart with one series prints each value on its bar, and a horizontal one grows taller with each label so bars keep one thickness.

## Differences from Charts

- Charts' `radar`, `polarArea` and `sankey` types, and charts built from a table with `id:`, show a message saying they are not supported yet.
- Keys not listed above are ignored. Raw Chart.js options in the block have no effect; use [the script function](script-api.md) for those.
- While Charts is enabled, Chartwork leaves `chart` blocks to it. Disable Charts and reload to switch over.

A block with a mistake shows what is wrong in place of the chart, such as "Series 2 has a value that is not a number".
