The Value labels option on charts of the books in this vault. A book with two genres counts in both. The line above each chart says what it should show.

Automatic on a single series. Each bar has its number: classic 8, adventure 4, then 3, 3, 3 and 2:

```base
filters:
  and:
    - file.inFolder("Books")
views:
  - type: chartwork-chart
    name: Single series, automatic
    title: Single series, automatic
    x: note.genre
```

Off on the same chart. No numbers:

```base
filters:
  and:
    - file.inFolder("Books")
views:
  - type: chartwork-chart
    name: Single series, off
    title: Single series, off
    x: note.genre
    valueLabels: off
```

Automatic with one series per status. No numbers until you hover:

```base
filters:
  and:
    - file.inFolder("Books")
views:
  - type: chartwork-chart
    name: Grouped, automatic
    title: Grouped, automatic
    x: note.genre
    groupBy:
      property: note.status
      direction: ASC
```

On with the same series. Every bar with a value has its number, and classic's bars read 1, 4, 1 and 2:

```base
filters:
  and:
    - file.inFolder("Books")
views:
  - type: chartwork-chart
    name: Grouped, on
    title: Grouped, on
    x: note.genre
    groupBy:
      property: note.status
      direction: ASC
    valueLabels: on
```

On for a line. Each point has its number:

```base
filters:
  and:
    - file.inFolder("Books")
views:
  - type: chartwork-chart
    name: Line, on
    title: Line, on
    x: note.genre
    kind: line
    valueLabels: on
```

On for a pie. Each slice has its number:

```base
filters:
  and:
    - file.inFolder("Books")
views:
  - type: chartwork-chart
    name: Pie, on
    title: Pie, on
    x: note.genre
    kind: pie
    valueLabels: on
```

A short stacked chart with small and large segments, from a `chart` block. The segments of 20 and up have their number, and the ones of 1 to 4 show none, so no numbers overlap:

```chart
type: bar
labels: [Mon, Tue, Wed, Thu, Fri]
stacked: true
valueLabels: true
height: 180
series:
  - title: Alpha
    data: [40, 2, 30, 1, 25]
  - title: Beta
    data: [3, 35, 2, 30, 4]
  - title: Gamma
    data: [20, 1, 22, 3, 28]
```
