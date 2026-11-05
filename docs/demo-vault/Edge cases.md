Charts pushed to their limits. The line above each chart says what it should show. Nothing here should draw blank, overlap itself or break the note. The table charts read the tables in this note, and the CSV chart reads `Edge cases.csv`, which sits beside it. The script chart needs Dataview.

30 labels, 3 series, horizontal. Every label shows, the bars are readable, and the legend doesn't overlap them:

```chart
type: bar
indexAxis: y
labels: [Item 1, Item 2, Item 3, Item 4, Category 5 with a long name, Item 6, Item 7, Item 8, Item 9, Category 10 with a long name, Item 11, Item 12, Item 13, Item 14, Category 15 with a long name, Item 16, Item 17, Item 18, Item 19, Category 20 with a long name, Item 21, Item 22, Item 23, Item 24, Category 25 with a long name, Item 26, Item 27, Item 28, Item 29, Category 30 with a long name]
series:
  - title: Alpha
    data: [8, 15, 22, 29, 36, 6, 13, 20, 27, 34, 4, 11, 18, 25, 32, 2, 9, 16, 23, 30, 37, 7, 14, 21, 28, 35, 5, 12, 19, 26]
  - title: Beta
    data: [12, 23, 34, 8, 19, 30, 4, 15, 26, 37, 11, 22, 33, 7, 18, 29, 3, 14, 25, 36, 10, 21, 32, 6, 17, 28, 2, 13, 24, 35]
  - title: Gamma
    data: [14, 27, 3, 16, 29, 5, 18, 31, 7, 20, 33, 9, 22, 35, 11, 24, 37, 13, 26, 2, 15, 28, 4, 17, 30, 6, 19, 32, 8, 21]
```

Tiny and huge numbers side by side, values printed. Labels stay readable and the axis ticks are not a wall of digits:

```chart
type: bar
labels: [Tiny, Small, Medium, Huge]
valueLabels: true
series:
  - title: Value
    data: [0.001, 42, 12345.678, 2500000]
```

Negative values, stacked. Bars go below zero and each stack adds up:

```chart
type: bar
stacked: true
labels: [Q1, Q2, Q3, Q4]
series:
  - title: Income
    data: [12, 8, 15, 4]
  - title: Costs
    data: [-9, -14, -6, -11]
```

Gaps. Both lines break at the gaps, the third is stepped with no dots:

```chart
type: line
labels: [a, b, c, d, e, f, g]
series:
  - title: Breaks
    data: [3, 5, null, 4, null, null, 6]
  - title: Also breaks
    data: [1, 2, null, 3, null, null, 2]
  - title: Steps
    data: [5, 6, 6, 8, 7, 9, 8]
    stepped: true
    pointRadius: 0
```

The same gaps with `spanGaps: true` on the block. Both lines now join across them:

```chart
type: line
spanGaps: true
labels: [a, b, c, d, e, f, g]
series:
  - title: Joins
    data: [3, 5, null, 4, null, null, 6]
  - title: Joins too
    data: [1, 2, null, 3, null, null, 2]
```

Everything at once on a line: title, axis titles, an average line per series, a line at y = 6, a line at label Wed, a trend line, values printed. The y axis stops at 10, so the 14 is cut off at the top:

```chart
type: line
title: A very long chart title that goes on and on to see whether it wraps or gets cut off at the edge of the note
labels: [Mon, Tue, Wed, Thu, Fri, Sat, Sun]
xTitle: Day
yTitle: Count
yMax: 10
yLine: [6]
xLine: [Wed]
average: true
bestFit: true
valueLabels: true
series:
  - title: Visits
    data: [2, 4, 3, 7, 5, 14, 6]
  - title: Calls
    data: [1, 1, 2, 2, 3, 3, 4]
```

One label, one value. A single sensible bar:

```chart
type: bar
labels: [Only]
series:
  - title: One
    data: [1]
```

All zeros. A flat line on a sensible axis, not an empty or broken chart:

```chart
type: line
labels: [a, b, c, d]
series:
  - title: Nothing
    data: [0, 0, 0, 0]
```

12 series. Colors run through the palette; note where they start repeating:

```chart
type: line
labels: [1, 2, 3, 4, 5]
legendPosition: right
series:
  - {title: S1, data: [1, 2, 3, 4, 5]}
  - {title: S2, data: [2, 3, 4, 5, 6]}
  - {title: S3, data: [3, 4, 5, 6, 7]}
  - {title: S4, data: [4, 5, 6, 7, 8]}
  - {title: S5, data: [5, 6, 7, 8, 9]}
  - {title: S6, data: [6, 7, 8, 9, 10]}
  - {title: S7, data: [7, 8, 9, 10, 11]}
  - {title: S8, data: [8, 9, 10, 11, 12]}
  - {title: S9, data: [9, 10, 11, 12, 13]}
  - {title: S10, data: [10, 11, 12, 13, 14]}
  - {title: S11, data: [11, 12, 13, 14, 15]}
  - {title: S12, data: [12, 13, 14, 15, 16]}
```

Pie with tiny slices and values printed. The big slices are labelled; the tiny ones shouldn't turn into a pile of overlapping numbers:

```chart
type: pie
labels: [Big, Medium, Tiny 1, Tiny 2, Tiny 3, Zero]
valueLabels: true
series:
  - title: Share
    data: [70, 25, 1, 1, 0.5, 0]
```

Radar with a value past its scale (rMax 5, one value 9). The shape is clipped at the edge, not drawn outside the chart:

```chart
type: radar
labels: [Plot, Prose, Pace, Ideas, Ending]
rMin: 0
rMax: 5
series:
  - title: Book
    data: [4, 9, 2, 5, 1]
```

Scatter with negative coordinates, both point styles. Points in all four quadrants:

```chart
type: scatter
xTitle: X
yTitle: Y
series:
  - title: Objects
    data: [{x: -5, y: 3}, {x: 4, y: -2}, {x: 0, y: 0}]
  - title: Pairs
    data: [[-3, -4], [6, 5], [2, -6]]
```

Unicode and emoji labels. All show, none as boxes:

```chart
type: bar
labels: [Ærøskøbing, Тест, 東京, "📚 Books", Ü]
series:
  - title: Count
    data: [3, 5, 2, 4, 1]
```

Narrow, 200 pixels wide. Still legible:

```chart
type: bar
width: 200
labels: [a, b, c]
series:
  - title: Narrow
    data: [3, 1, 2]
```

Inside a callout. Fits the callout and takes its text color:

> [!note] A chart in a callout
> ```chart
> type: doughnut
> labels: [Yes, No, Maybe]
> legendPosition: right
> series:
>   - title: Answers
>     data: [5, 2, 3]
> ```

A messy table: blank cells, decimal commas, a link as a label, a row of text. The text row is skipped and the blanks are gaps:

|            | Mon | Tue | Wed  |
| ---------- | --- | --- | ---- |
| [[Books]]  | 1,5 |     | 3    |
| Films      | 2   | 4   | 0,25 |
| Notes      | n/a | n/a | n/a  |
^messy

```chart
type: line
id: messy
layout: rows
```

From the CSV file next to this note (its second header has a comma inside quotes, Feb has a blank). Then open `Edge cases.csv`, change Jan's 4 to 10 and come back: the chart should have redrawn:

```chart
type: bar
csv: Edge cases.csv
```

2,000 points from a script. Draws within a second or two and scrolling past it stays smooth:

```dataviewjs
const n = 2000;
window.chartwork.render(dv.container, {kind: "line", labels: Array.from({length: n}, (_, i) => String(i)), series: [{name: "Noise", values: Array.from({length: n}, (_, i) => Math.round(50 + 30 * Math.sin(i / 40) + 10 * Math.sin(i * 7)))}]}, dv.component);
```
