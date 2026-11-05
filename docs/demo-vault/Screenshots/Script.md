Needs a plugin that runs JavaScript in notes, such as Dataview.

```dataviewjs
window.chartwork.render(dv.container, {
  kind: "pie",
  labels: ["Read", "Reading", "To read"],
  series: [{ name: "Books", values: [7, 2, 5] }],
}, dv.component);
```
