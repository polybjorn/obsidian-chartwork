Bases charts that open the notes behind them. The line above each chart says what a click should do. Hold Ctrl, or Cmd on macOS, to open the note in a new tab. On a phone, the first tap shows the tooltip and a second tap on the same element opens the notes.

Bars by author. Clicking Bram Stoker opens Dracula, the only book in that bar. Clicking Jules Verne lists two books in a menu:

```base
filters:
  and:
    - file.inFolder("Books")
views:
  - type: chartwork-chart
    name: By author
    x: note.author
```

A doughnut. Clicking the reading slice lists Dracula and The Adventures of Sherlock Holmes:

```base
filters:
  and:
    - file.inFolder("Books")
views:
  - type: chartwork-chart
    name: Doughnut
    kind: doughnut
    x: note.status
```

Two genres and the rest. Clicking The rest lists the notes of every genre it adds up, each book once:

```base
filters:
  and:
    - file.inFolder("Books")
views:
  - type: chartwork-chart
    name: The rest
    x: note.genre
    categorySort: value
    topN: 2
    other: The rest
```

A running total. A point lists only the notes of its own status, not those before it, so clicking the last point lists just its own books:

```base
filters:
  and:
    - file.inFolder("Books")
views:
  - type: chartwork-chart
    name: Running total
    kind: line
    x: note.status
    cumulative: true
```

A scatter. Clicking a point opens that book:

```base
filters:
  and:
    - file.inFolder("Books")
views:
  - type: chartwork-chart
    name: Scatter
    kind: scatter
    x: note.year
    y: note.pages
```
