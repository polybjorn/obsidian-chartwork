Scatter charts of the books in this vault, with points sized by a property. The line above each chart says what it should show. Hover a point to read its tooltip. Nine books have a rating, and the seven unrated ones show how a note without a value draws.

Sized by rating. Pride and Prejudice (5) is the largest point and Moby-Dick (1.5) the smallest. All 16 books draw, the unrated ones at a middle size. Hovering a rated book shows year, pages and rating in the tooltip, and hovering an unrated one shows only year and pages:

```base
filters:
  and:
    - file.inFolder("Books")
views:
  - type: chartwork-chart
    name: By rating
    kind: scatter
    x: note.year
    y: note.pages
    size: note.rating
```

Grouped by status. Sizes compare across the series: Pride and Prejudice in read is still the largest and Moby-Dick in dropped the smallest. Everything in reading and to read is unrated, so those points share the middle size. Each tooltip names the status on the line under the title, and no tooltip here has a color square:

```base
filters:
  and:
    - file.inFolder("Books")
views:
  - type: chartwork-chart
    name: By status
    kind: scatter
    x: note.year
    y: note.pages
    size: note.rating
    groupBy:
      property: note.status
      direction: ASC
```

Sized by a property that holds text. Nothing reads as a number, so every point is the same middle size and every tooltip shows only year and pages:

```base
filters:
  and:
    - file.inFolder("Books")
views:
  - type: chartwork-chart
    name: By text
    kind: scatter
    x: note.year
    y: note.pages
    size: note.status
```

No size property. Every point is small and the same size, and every tooltip shows only year and pages:

```base
filters:
  and:
    - file.inFolder("Books")
views:
  - type: chartwork-chart
    name: Unsized
    kind: scatter
    x: note.year
    y: note.pages
```
