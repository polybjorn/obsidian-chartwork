# Chartwork

Turn your notes into charts. Make one from a [Bases](https://help.obsidian.md/bases) view, a code block or a script. They match your theme, light or dark, with nothing to set up, and notes written for the [Charts](https://github.com/phibr0/obsidian-charts) plugin draw as they are.

<img src="docs/images/readme.png" width="560" alt="Four charts in Obsidian's dark theme: a doughnut and a bar chart from Bases, a radar chart and a line chart from code blocks">

## Three ways to make a chart

| Way | Use it when | Needs |
|---|---|---|
| [Bases view](https://github.com/polybjorn/obsidian-chartwork/blob/main/docs/bases-view.md) | the numbers are note properties, like books counted by status or hours summed by project | Bases, built into [Obsidian](https://obsidian.md) |
| [`chart` code block](https://github.com/polybjorn/obsidian-chartwork/blob/main/docs/code-block.md) | the numbers are in no note, so you type them in | nothing else |
| [Script function](https://github.com/polybjorn/obsidian-chartwork/blob/main/docs/script-api.md) | the numbers have to be worked out first, like notes created this month counted by tag | a plugin that runs JavaScript in notes, such as [Dataview](https://github.com/blacksmithgu/obsidian-dataview) |

Any Chart.js config: [Beyond the basics](https://github.com/polybjorn/obsidian-chartwork/blob/main/docs/advanced.md).

The smallest chart is a code block:

````markdown
```chart
type: line
labels: [Jan, Feb, Mar, Apr]
series:
  - title: Pages read
    data: [320, 450, 280, 510]
```
````

Chartwork needs Obsidian 1.10.2 or later. [Chart.js](https://www.chartjs.org) 4 is bundled, so Bases views and code blocks need nothing else installed. The plugin is about 290 KB, almost all of it Chart.js and its sankey and annotation plugins.

## What Chartwork takes care of

- **Theme colors and text size.** Text, grid lines and series follow your theme, light or dark, and redraw when you switch. Chart text follows the note's text size. In a Bases view or a script, any CSS color sets a category apart, such as `var(--color-green)`.
- **Values on the bars** of a bar chart with one series.
- **Even horizontal bars.** The chart grows taller with each category, so bars keep one thickness.
- **Dates on a time axis.** A Bases view groups dates by day, week, month or year, with a gap where nothing happened.
- **Order and trimming.** In a Bases view or a script: sort by value or label, put chosen categories first, keep the largest few and add the rest up under one label.

## Compared with other chart plugins

**[Charts](https://github.com/phibr0/obsidian-charts)** has had no release since January 2024, runs Chart.js 3 and has no Bases view. Chartwork draws its `chart` blocks and `renderChart` scripts as they are, on Chart.js 4, and the command **Check chart blocks and scripts** lists any that won't. While Charts is enabled, Chartwork leaves its blocks to it. Its chart-builder menu and image export are not in Chartwork.

**[Tracker](https://github.com/pyrochlore/obsidian-tracker)** finds values in your notes and plots them by date, but it adds up two values from the same day and can't total by week or month. In Chartwork, Bases or a script finds the values, and a Bases view groups dates by day, week, month or year with a count, sum, average, minimum or maximum. Tracker's month calendar and streak summaries are not in Chartwork.

**[Bases Charts](https://github.com/mProjectsCode/obsidian-bases-charts-plugin)** draws one point per note as a scatter, line or bar chart, so it can't count notes or add them up per category, and it has no pie chart. Chartwork's Bases view does both, keeps the largest few with the rest added up and colors each category. Scatter charts are not in Chartwork yet.

## What the plugin accesses

- **Vault, read-only.** Chartwork reads what a Bases view or script hands it, the note or CSV file a `chart` block names, and, for the check command, your notes. It writes nothing. A Bases view's options are saved into its `.base` file by Bases itself.
- **No network.** The plugin makes no outbound requests.
