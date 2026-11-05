Keys that do nothing. Each chart below still draws, and the line above it gives the muted line to expect under it. Where it says no line, there must be none. The script charts need Dataview.

A misspelt key. Expect: Chartwork doesn't know valuelabels (did you mean valueLabels?), so it does nothing.

```chart
type: bar
labels: [Mon, Tue, Wed]
valuelabels: true
series:
  - title: Pages
    data: [12, 30, 18]
```

Two keys Chartwork has never heard of, one named after a built-in. Expect: Chartwork doesn't know colour or constructor, so they do nothing.

```chart
type: line
labels: [Mon, Tue, Wed]
colour: red
constructor: 1
series:
  - title: Pages
    data: [12, 30, 18]
```

An option a pie has no use for. Expect: A pie chart doesn't use average.

```chart
type: pie
labels: [Fiction, Poetry, Essays]
average: true
series:
  - title: Books
    data: [7, 3, 4]
```

Both at once, on one line. Expect: Chartwork doesn't know tilte (did you mean title?), so it does nothing. A doughnut chart doesn't use xLine.

```chart
type: doughnut
labels: [Fiction, Poetry, Essays]
tilte: Shelf
xLine: 2
series:
  - title: Books
    data: [7, 3, 4]
```

The same option turned off asks for nothing. No line.

```chart
type: radar
labels: [Plot, Pace, Style]
valueLabels: false
series:
  - title: Book
    data: [4, 2, 5]
```

A note written for Charts, with keys Chartwork leaves alone. No line.

```chart
type: bar
labels: [Mon, Tue, Wed]
transparency: 0.4
textColor: "#888"
padding: 10
time: day
series:
  - title: Pages
    data: [12, 30, 18]
```

The same on a pie, with a Charts key it has no use for. No line.

```chart
type: pie
labels: [Fiction, Poetry, Essays]
indexAxis: y
series:
  - title: Books
    data: [7, 3, 4]
```

A chart drawn from a table keeps its line. Expect: Chartwork doesn't know layot (did you mean layout?), so it does nothing.

| Day | Pages |
| --- | ----- |
| Mon | 12    |
| Tue | 30    |
| Wed | 18    |

^hint-pages

```chart
type: bar
id: hint-pages
layot: rows
```

A script field the chart's kind does not use. Expect: A pie chart doesn't use horizontal.

```dataviewjs
window.chartwork.render(dv.container, {kind: "pie", labels: ["Fiction", "Poetry"], series: [{name: "Books", values: [7, 3]}], horizontal: true}, dv.component);
```

A script chart that changes kind takes its line with it. Expect a bar chart and no line.

```dataviewjs
const chart = window.chartwork.render(dv.container, {kind: "pie", labels: ["Fiction", "Poetry"], series: [{name: "Books", values: [7, 3]}], horizontal: true}, dv.component);
chart.update({kind: "bar", labels: ["Fiction", "Poetry"], series: [{name: "Books", values: [7, 3]}], horizontal: true});
```

A script spec with two wrong fields. Expect an error naming both, with valueLabels as the guess for the first and the fields each place takes.

```dataviewjs
window.chartwork.render(dv.container, {kind: "bar", labels: ["Fiction", "Poetry"], valuelabels: true, series: [{name: "Books", values: [7, 3], colour: "red"}]}, dv.component);
```
