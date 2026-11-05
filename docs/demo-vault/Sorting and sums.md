Bases charts that sort and sum, from the books in this vault. The line above each chart says what it should show.

Sorted by value. A doughnut of the books per genre, largest first from classic at 8, then adventure at 4, three genres at 3 and horror at 2:

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

Summed, sorted and cut to the six largest. Horizontal bars of the pages per author, from Louisa May Alcott at 759 down to Charlotte Brontë at 507, with the other seven authors left out:

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
