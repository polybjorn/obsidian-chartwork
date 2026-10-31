# Chartwork

Turn your notes into charts. Make one from a Bases view, a code block or a script. Charts match your theme, light or dark, with nothing to set up.

<img src="docs/images/readme.png" width="560" alt="Four charts in Obsidian's dark theme: a doughnut of books by genre and a bar chart of pages by author from Bases, a stacked bar chart of reading hours by weekday and a line chart of pages per month from code blocks">

## Three ways to make a chart

| Way | Use it when | Needs |
|---|---|---|
| [Bases view](https://github.com/polybjorn/obsidian-chartwork/blob/main/docs/bases-view.md) | the numbers are note properties, like books counted by status or hours summed by project | Bases, built into Obsidian |
| [`chart` code block](https://github.com/polybjorn/obsidian-chartwork/blob/main/docs/code-block.md) | the numbers are in no note, so you type them in | nothing else |
| [Script function](https://github.com/polybjorn/obsidian-chartwork/blob/main/docs/script-api.md) | the numbers have to be worked out first, like notes created this month counted by tag | a plugin that runs JavaScript in notes, such as Dataview |

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

## Requirements

Obsidian 1.10.2 or later. Chart.js 4 is bundled, so Bases views and code blocks need nothing else installed. The plugin is about 230 KB, almost all of it Chart.js.

## What Chartwork takes care of

- **Theme colours.** Text, grid lines and series follow your theme, light or dark, and redraw when you switch. In a Bases view or a script, any CSS colour sets a category apart, such as `var(--color-green)`.
- **Values on the bars** of a bar chart with one series.
- **Even horizontal bars.** The chart grows taller with each category, so bars keep one thickness.
- **Order and trimming.** In a Bases view or a script: sort by value or label, put chosen categories first, keep the largest few and add the rest up under one label.
- **Notes made for the Charts plugin.** Its `chart` blocks and `window.renderChart` calls draw as they are, and the command **Check chart blocks and scripts** lists any that won't. While Charts is enabled, Chartwork leaves them to it and says so once.

## What the plugin accesses

- **Vault, read-only.** Chartwork sees only the data a Bases view, `chart` block or script hands it, and writes nothing. The check command reads your notes to find chart blocks and scripts. A Bases view's options are saved into its `.base` file by Bases itself.
- **No network.** The plugin makes no outbound requests.
