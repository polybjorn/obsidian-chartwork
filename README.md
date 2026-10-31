# Chartwork

Charts in Obsidian, made from your notes, in three ways that are drawn alike and take their colours from your theme, light or dark:

| Way | Use it when | Needs |
|---|---|---|
| Bases view | the numbers are note properties, like books counted by status or hours summed by project | Bases, built into Obsidian |
| `chart` code block | the numbers are in no note, so you type them in | nothing else |
| JavaScript function | the numbers have to be worked out first, like notes created this month counted by tag | a plugin that runs JavaScript in notes, such as Dataview |

| Light theme | Dark theme |
|---|---|
| ![Horizontal bar chart of books by genre in a Bases view, light theme](docs/images/theme-light.png) | ![The same chart in the dark theme](docs/images/theme-dark.png) |

Chartwork only sees the data Obsidian passes to a view, or that a code block or script hands it. It writes nothing to your vault and makes no network requests; Chart.js 4 is bundled.

> Not released yet; it runs my own vault.

## Why another chart plugin

The most installed chart plugin, Charts, has had no release since January 2024 and still ships Chart.js 3. Newer plugins chart Bases views well, but nothing else.

My vault needs all three, and each chart there carried the same extra code to look right: theme colours so text stays readable on dark, the value on each bar, horizontal bars of one thickness from note to note. Chartwork does that itself, so a chart only says what to show.

Two charts from my vault show the difference. Books counted by reading status took 87 lines of Dataview JavaScript with Charts. With Chartwork it is a Bases view embedded in the note, most of it set up in the view's options:

```yaml
filters:
  and:
    - tags.contains("Media")
    - hierarchy.contains(link("Books"))
formulas:
  state: 'if(consumed == "active", "Reading", if(consumed == "yes", "Yes", if(consumed == "no", "No", if(consumed == "paused", "Paused", if(consumed == "dropped", "Dropped")))))'
views:
  - type: chartwork-chart
    name: Consumption
    x: formula.state
    categoryOrder: Reading, Yes, No, Paused, Dropped
    skipEmpty: true
    colors:
      - "Reading: rgb(173,247,182)"
      - "Yes: rgb(158,202,225)"
```

![A Bases chart view with its options open: category property, aggregation, chart type, horizontal bars and title](docs/images/bases-view.png)

Notes created this month, counted by tag, is a script in my vault. With Charts it went through a 57-line helper that themed and labelled a raw Chart.js config. With Chartwork the script only works out the numbers:

```js
const tags = {};
for (const page of dv.pages().where((p) => p.file.cday >= dv.date("2026-10-01"))) {
  for (const tag of page.tags ?? []) tags[tag] = (tags[tag] ?? 0) + 1;
}
window.chartwork.render(dv.container, {
  kind: "bar",
  horizontal: true,
  labels: Object.keys(tags),
  series: [{ name: "Notes", values: Object.values(tags) }],
  topN: 10,
}, dv.component);
```

If you use Charts now, Chartwork reads Charts' `chart` blocks and `window.renderChart` calls as they are, so switching shouldn't mean editing your notes. While Charts is enabled, Chartwork leaves both to it.

## Docs

- [Bases view](docs/bases-view.md): every option, and how to chart a formula when the property's values need renaming
- [Chart code block](docs/code-block.md): the YAML keys, and what differs from Charts
- [Script function](docs/script-api.md): the full spec for `window.chartwork.render`, and Charts' `renderChart`

Licensed under [MIT](LICENSE).
