Charts that are written wrong on purpose. Each one should show a short error box in place of the chart, never a blank space or a broken note. The line above each chart gives the error to expect. The script chart needs Dataview.

Unknown type. Expect an error box reading: Chartwork can't draw this chart: Unknown chart type "banana". Use bar, line, pie, doughnut, radar, polarArea, scatter or sankey.

```chart
type: banana
labels: [a]
series:
  - title: x
    data: [1]
```

A value that is not a number. Expect an error box reading: Chartwork can't draw this chart: Series "Books" has a value that is not a number: "lots".

```chart
type: bar
labels: [a, b]
series:
  - title: Books
    data: [1, lots]
```

CSV file that doesn't exist. Expect an error box reading: Chartwork can't draw this chart: The file "no-such-file.csv" was not found.

```chart
type: bar
csv: no-such-file.csv
```

A csv key together with id. Expect an error box reading: Chartwork can't draw this chart: Use either csv or id, not both. csv reads a CSV file; id reads a table in a note, with file naming the note when it is another one.

```chart
type: bar
id: messy
csv: Edge cases.csv
```

Broken YAML. Expect an error box reading: Chartwork can't draw this chart: The block's formatting is broken near line 3. Look for an unclosed bracket, a missing space after a colon, or uneven indentation.

```chart
type: bar
labels: [a, b
series: oops
```

A script asking for a chart type that doesn't exist. Expect an error box reading: Chartwork can't draw this chart: Unknown chart type "banana". Check the spelling. If it comes from an add-on, load the add-on or call chartwork.register before this chart draws.

```dataviewjs
window.chartwork.render(dv.container, {type: "banana", data: {labels: ["a"], datasets: [{data: [1]}]}}, dv.component);
```
