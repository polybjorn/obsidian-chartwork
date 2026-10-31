# Chartwork

Charts in Obsidian, made from your notes and drawn in your theme's colours, light or dark.

| Light theme | Dark theme |
|---|---|
| ![Bar chart of books by reading status, light theme](docs/images/theme-light.png) | ![The same chart in the dark theme](docs/images/theme-dark.png) |

> Not released yet; it runs my own vault.

There are three ways to make a chart.

**From note properties, in a Bases view.** Add a view to a base, pick **Chart** as its layout and choose the property to count by, like a book's `genre`. No code.

<img src="docs/images/bases-view.png" width="240" alt="The options of a Bases chart view: layout, category property, aggregation, chart type, horizontal bars and title">

**From numbers you type in,** in a `chart` code block:

````markdown
```chart
type: line
labels: [Jan, Feb, Mar, Apr]
series:
  - title: Pages read
    data: [320, 450, 280, 510]
```
````

<img src="docs/images/code-block.png" width="440" alt="The line chart this block draws">

**From a script.** A script works out the numbers, and Chartwork draws them. This needs a plugin that runs JavaScript in notes, such as Dataview.

```js
window.chartwork.render(dv.container, {
  kind: "pie",
  labels: ["Read", "Reading", "To read"],
  series: [{ name: "Books", values: [7, 2, 5] }],
}, dv.component);
```

<img src="docs/images/script.png" width="440" alt="The pie chart this script draws">

## Good to know

- Text, grid lines and colours follow your theme, and a chart redraws when you switch between light and dark.
- Bar charts print each value on its bar.
- Notes written for the Charts plugin keep working.
- Chartwork writes nothing to your vault and makes no network requests.

## Docs

- [Bases view](docs/bases-view.md): every option, including sorting, colours and keeping the largest few categories
- [Chart code block](docs/code-block.md): every key, and what differs from Charts
- [Script function](docs/script-api.md): everything `window.chartwork.render` takes
