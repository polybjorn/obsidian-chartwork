# Chart code block

For numbers that live in no note, type them into a `chart` code block. The format is the one the Charts plugin uses, so existing blocks draw without changes.

````markdown
```chart
type: line
labels: [Jan, Feb, Mar, Apr]
series:
  - title: Pages read
    data: [320, 450, 280, 510]
```
````

<img src="images/code-block.png" width="560" alt="A line chart of pages read per month, drawn from a chart code block">

`type`, `labels` and `series` are required. Each series has a `title` and a `data` list with one value per label; `null` leaves a gap.

| Key | Applies to | What it does |
|---|---|---|
| `type` | all | `bar`, `line`, `pie`, `doughnut`, `radar`, `polarArea` or `sankey` |
| `indexAxis: y` | bar, line | Horizontal bars |
| `stacked: true` | bar, line | Stack the series |
| `fill` | line, radar | `true` fills the area under each line. Radar shapes are filled unless `fill: false` |
| `tension` | line | Curve, 0 for straight segments. Default 0.2 |
| `beginAtZero` | bar, line, radar | Start the value axis at zero. Default `true` |
| `xTitle` / `yTitle` | bar, line | Title for the value axis (`xTitle` when the bars are horizontal) |
| `legend` | all | `false` hides the legend, `true` shows it |
| `legendPosition` | all | `top`, `bottom`, `left` or `right` |
| `width` | all | Chart width, as CSS (`60%`) or pixels (`400`) |

Colours come from the theme, or from the list under Series colors in Chartwork's settings. A radar chart takes its spokes from `labels` and draws one shape per series. A `polarArea` chart draws one segment per label, sized by the first series. A bar chart with one series prints each value on its bar, and a horizontal one grows taller with each label so bars keep one thickness.

## Chart from a table

Put a block id on the line after a table, then name it with `id`.

````markdown
|       | Q1 | Q2 | Q3 |
| ----- | -- | -- | -- |
| Books | 12 | 9  | 14 |
| Films | 4  | 7  | 5  |
^reading

```chart
type: bar
id: reading
layout: rows
```
````

| Key | What it does |
|---|---|
| `id` | The table's block id |
| `layout` | `rows`: each row is a series. `columns` (default): each column is a series |
| `select` | Rows or columns to draw, such as `[Books]`. Default all |
| `file` | The note holding the table, if not this one |

The first row and column hold the names. Lines without numbers are skipped.

A `sankey` block takes rows of `[from, flow, to]` in the first series, as Charts does, plus optional `priority`, `colorFrom` and `colorTo` maps from node name to a number or CSS colour. Nodes without a colour take the theme's.

## Differences from Charts

- Keys not listed above are ignored. Raw Chart.js options in the block have no effect; use [the script function](script-api.md) for those.
- While Charts is enabled, Chartwork leaves `chart` blocks to it, and says so once. Disable Charts and reload to switch over.

Before removing Charts, run **Check chart blocks and scripts** from the command palette, or press **Check notes first** on that notice. It lists every block Chartwork can't draw or draws without some of its keys, and every script that calls `renderChart`, with a link to each line.

A block with a mistake shows what is wrong in place of the chart, such as "Series 2 has a value that is not a number".
