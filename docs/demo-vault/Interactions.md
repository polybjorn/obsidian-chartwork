Things to try by hand. Each line says what to do and what should happen. On a phone, a tap stands in for a hover.

Hiding a series. Click Fiction in the legend: its entry turns gray and its bars go. Click it again and they return. Hover a bar: the tooltip sits beside it, level with its middle. On a dark theme the tooltip has a thin outline, so its edge shows against the note:

```chart
type: bar
labels: [Jan, Feb, Mar, Apr]
series:
  - title: Fiction
    data: [4, 7, 3, 6]
  - title: Non-fiction
    data: [2, 3, 5, 4]
```

Hitting a line point. Hover or tap close to a point, not exactly on it: the tooltip still shows that point. Try it with a finger on a phone:

```chart
type: line
labels: [Mon, Tue, Wed, Thu, Fri, Sat, Sun]
series:
  - title: Pages
    data: [12, 30, 18, 42, 25, 8, 36]
```

Theme and text size. Switch between light and dark: this chart recolors without a reload. Change the font size in Appearance: its text changes size with the note:

```chart
type: doughnut
labels: [Read, Reading, Unread]
series:
  - title: Books
    data: [9, 2, 5]
```
