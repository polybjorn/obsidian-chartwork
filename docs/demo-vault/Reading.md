Sixteen books, counted by where I am with them.

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
    colors:
      - "reading: var(--color-green)"
      - "read: var(--color-blue)"
      - "to read: var(--color-yellow)"
      - "dropped: var(--color-base-50)"
```
