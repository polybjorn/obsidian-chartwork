A book with two genres counts in both.

```base
filters:
  and:
    - file.inFolder("Books")
views:
  - type: chartwork-chart
    name: By genre
    x: note.genre
    horizontal: true
    categorySort: value
    title: Books by genre
```
