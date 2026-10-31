# Chartwork

Charts in Obsidian, made from your notes. Point a Bases view at a property, type numbers into a code block, or hand numbers over from a script, and Chartwork draws them in your theme's colours, light or dark. A chart looks like part of the note it sits in, with no settings to tune first.

![A note with a Bases chart of books by status and a line chart of pages read, in Obsidian's dark theme](docs/images/readme.png)

Docs: [Bases view](docs/bases-view.md), [chart code block](docs/code-block.md), [script function](docs/script-api.md).

> Not released yet; it runs my own vault.

## Three ways to make a chart

| Way | Use it when | Needs |
|---|---|---|
| Bases view | the numbers are note properties, like books counted by status or hours summed by project | Bases, built into Obsidian |
| `chart` code block | the numbers are in no note, so you type them in | nothing else |
| Script function | the numbers have to be worked out first, like notes created this month counted by tag | a plugin that runs JavaScript in notes, such as Dataview |

## What Chartwork takes care of

- **Your theme's colours.** Text, grid lines and series follow the theme, so a chart stays readable in light and dark and redraws when you switch. In a Bases view or a script, any CSS colour sets a category or series apart, including the theme's own, like `var(--color-green)`.
- **Values on the bars.** A bar chart with one series prints each value on its bar.
- **Even horizontal bars.** A horizontal chart grows taller with each category, so bars keep one thickness from note to note.
- **Order and trimming.** In a Bases view or a script, sort by value or label, put chosen categories first, keep the largest few and add the rest up under one label.
- **Notes made for the Charts plugin.** Chartwork draws its `chart` blocks and `window.renderChart` calls as they are, and leaves both to Charts while it is enabled.
- **Nothing leaves your vault.** Chartwork only sees the data a Bases view, code block or script hands it. It writes nothing to your vault and makes no network requests; Chart.js 4 is bundled.
