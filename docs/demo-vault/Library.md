Two charts from the books in this vault, and two typed in by hand.

```base
filters:
  and:
    - file.inFolder("Books")
views:
  - type: chartwork-chart
    name: Genres
    x: note.genre
    kind: doughnut
    categorySort: value
```

```base
filters:
  and:
    - file.inFolder("Books")
views:
  - type: chartwork-chart
    name: Pages by author
    x: note.author
    aggregation: sum
    y: note.pages
    horizontal: true
    categorySort: value
    topN: 6
```

```chart
type: bar
labels: [Mon, Tue, Wed, Thu, Fri, Sat, Sun]
stacked: true
series:
  - title: Paper
    data: [0.5, 0.25, 0.5, 0.25, 0.75, 1.5, 2]
  - title: Ebook
    data: [0.75, 1, 0.5, 1, 0.5, 0.5, 0.25]
  - title: Audio
    data: [1, 0.75, 1, 1.25, 0.5, 0.25, 0.5]
yTitle: Hours
```

```chart
type: line
labels: [Jan, Feb, Mar, Apr, May, Jun, Jul, Aug, Sep, Oct, Nov, Dec]
tension: 0.3
series:
  - title: "2025"
    data: [310, 280, 420, 390, 510, 640, 720, 690, 450, 380, 300, 420]
  - title: "2026"
    data: [360, 410, 380, 520, 600, 580, 810, 760, 540, 470, null, null]
```
