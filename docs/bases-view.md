# Bases view

Chartwork adds a view type called **Chart** to Bases. Pick it from the view menu of any base, or of a `base` code block in a note, and set it up in the view's options. Each note in the base is one row; the chart counts the rows, or adds up a property, per category.

<img src="images/bases-view.png" width="560" alt="A Bases chart view of books by genre, under the base toolbar">

## Options

| Option | Key in the `.base` file | What it does |
|---|---|---|
| Category property | `x` | The property that names each bar or slice. A list property puts a note in every category it lists. Links show as the note name, tags without the `#`. |
| Aggregation | `aggregation` | `count` (the default) counts notes, `sum` adds up the value property, `average` averages it. |
| Value property | `y` | The number to sum or average. Hidden while counting. Text that reads as a number, like `"412"` or `3,5`, counts as one; anything else is skipped. |
| Chart type | `kind` | `bar`, `line`, `pie` or `doughnut`. |
| Horizontal bars | `horizontal` | Bars run sideways, and the chart grows taller with each category so bars keep the same thickness. |
| Title | `title` | Shown above the chart. |
| Sort | `categorySort` | `none` keeps the order categories first appear in, `value` puts the largest first, `label` sorts by name. |
| Largest categories to keep | `topN` | Keep only this many categories, by value. 0 keeps all. |
| Label for the rest | `other` | With the option above, adds the dropped categories together under this label. Left empty, they are left out. |
| Order first | `categoryOrder` | Comma-separated labels to place first, in this order. The rest follow by Sort. |
| Category colors | `categoryColors` | One `label: color` line per category, for single-series bar, pie and doughnut charts. Any CSS color works, including `var(--color-green)`. |
| Skip empty categories | `skipEmpty` | Leave out notes with no category value. Otherwise they are counted under `(none)`, placed last. |

When the base is grouped, each group becomes its own series: one bar per group within each category, and a legend.

Bases keeps `sort` and `order` for its own settings, which is why Chartwork's are named `categorySort` and `categoryOrder`.

## Mapping values to labels

The category is the property's value as it is. To rename values, merge some or leave others out, chart a formula instead. This one turns `consumed` into readable labels; the innermost `if` has no else, so any other value is empty, and Skip empty categories drops it:

```yaml
formulas:
  state: 'if(consumed == "active", "Reading", if(consumed == "yes", "Yes", if(consumed == "no", "No")))'
views:
  - type: chartwork-chart
    name: Reading status
    x: formula.state
    categoryOrder: Reading, Yes, No
    skipEmpty: true
    categoryColors:
      - "Reading: var(--color-green)"
```
