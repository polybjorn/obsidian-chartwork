Stacked Bases charts of the books in this vault: each genre split by status. A book with two genres counts in both. The line above each chart says what it should show. Every grouped chart has four series, dropped, read, reading and to read.

Stacked bars. Each genre is one bar. classic is the tallest at 8, then adventure at 4, and the others at 3 or 2:

```base
filters:
  and:
    - file.inFolder("Books")
views:
  - type: chartwork-chart
    name: Bars
    x: note.genre
    stacked: true
    groupBy:
      property: note.status
      direction: ASC
```

The same chart with Stacked off, for comparison. The bars for each genre stand side by side, and the value axis stops well below the stacked chart's:

```base
filters:
  and:
    - file.inFolder("Books")
views:
  - type: chartwork-chart
    name: Side by side
    x: note.genre
    groupBy:
      property: note.status
      direction: ASC
```

Stacked lines. The top line reaches 8 at classic. A line shows the stack up to that series, so it reads higher than the series' own count:

```base
filters:
  and:
    - file.inFolder("Books")
views:
  - type: chartwork-chart
    name: Lines
    kind: line
    x: note.genre
    stacked: true
    groupBy:
      property: note.status
      direction: ASC
```

Running total and an average line. Each series is summed first, then stacked, so the last bar reaches 23. The dashed lines sit at the mean of the stack up to each series: read is near 9.2, where its own mean is 6.7:

```base
filters:
  and:
    - file.inFolder("Books")
views:
  - type: chartwork-chart
    name: Running total
    x: note.genre
    stacked: true
    cumulative: true
    average: true
    groupBy:
      property: note.status
      direction: ASC
```

Horizontal. classic is the longest bar at 8:

```base
filters:
  and:
    - file.inFolder("Books")
views:
  - type: chartwork-chart
    name: Horizontal
    x: note.genre
    stacked: true
    horizontal: true
    groupBy:
      property: note.status
      direction: ASC
```

One series. Stacked changes nothing visible: plain bars of 5, 2, 7 and 2 with their values printed:

```base
filters:
  and:
    - file.inFolder("Books")
views:
  - type: chartwork-chart
    name: One series
    x: note.status
    stacked: true
```

A pie with a left-over `stacked` key, as a view keeps it after a change of chart type. It draws as a normal pie, and the Stacked option is hidden in its view options:

```base
filters:
  and:
    - file.inFolder("Books")
views:
  - type: chartwork-chart
    name: Pie
    kind: pie
    x: note.status
    stacked: true
```
