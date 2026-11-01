Four charts from the books in this vault, for the README's overview image.

```base
filters:
  and:
    - file.inFolder("Books")
views:
  - type: chartwork-chart
    name: By status
    x: note.status
    title: Books by status
    categoryOrder: reading, read, to read, dropped
    categoryColors:
      - "reading: var(--color-green)"
      - "read: var(--color-blue)"
      - "to read: var(--color-yellow)"
      - "dropped: var(--color-base-50)"
```

```base
filters:
  and:
    - file.inFolder("Books")
views:
  - type: chartwork-chart
    name: Authors
    x: note.author
    kind: doughnut
    aggregation: sum
    y: note.pages
    categorySort: value
    topN: 5
    other: Others
    title: Pages by author, top 5
```

```base
filters:
  and:
    - file.inFolder("Books")
views:
  - type: chartwork-chart
    name: Pages per month
    x: note.finished
    dateUnit: month
    aggregation: sum
    y: note.pages
    title: Pages finished per month
```

```base
filters:
  and:
    - file.inFolder("Books")
views:
  - type: chartwork-chart
    name: Genres
    x: note.genre
    horizontal: true
    categorySort: value
    title: Books by genre
```
