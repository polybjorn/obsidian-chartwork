Right-click a chart and choose **Copy chart as image**, then paste it somewhere else. The line above each chart says what the pasted image should show. Try it in light and dark themes: the image has the theme's background, never a transparent one.

A `chart` block. All four bars, sharp on a high-density screen. Hover a bar first: neither the tooltip nor the highlight is in the image:

```chart
type: bar
labels: [Jan, Feb, Mar, Apr]
series:
  - title: Pages read
    data: [320, 450, 280, 510]
```

A Bases chart. Hide the read series through the legend first: the image leaves it out too, and the chart keeps it hidden after the copy:

```base
filters:
  and:
    - file.inFolder("Books")
views:
  - type: chartwork-chart
    name: Copy
    x: note.genre
    groupBy:
      property: note.status
      direction: ASC
```

A script chart. Needs a plugin that runs JavaScript in notes, such as Dataview:

```dataviewjs
window.chartwork.render(dv.container, {
  type: "doughnut",
  data: {labels: ["Read", "Reading", "To read"], datasets: [{data: [7, 2, 5]}]},
}, dv.component);
```
