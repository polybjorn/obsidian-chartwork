# Chartwork

Charts in Obsidian, made from your notes. Pick properties in a Bases view, type numbers into a code block, or compute them in a script. All three are drawn the same way and take their colours from your theme, light or dark.

> Early development. Nothing is released yet, and this page describes what the first version is meant to do.

## Why another chart plugin

The most installed chart plugin, Charts, has had no release since January 2024 and still ships Chart.js 3. Newer plugins draw charts from Bases views, and do that well, but only that: none of them can chart numbers you computed yourself or typed in by hand.

My own vault needs all three, and each chart there carries the same extra code to look right: reading the theme's colours so text stays readable on a dark background, putting the value on each bar, keeping horizontal bars the same thickness from one note to the next. Chartwork does that part itself, so a chart only has to say what to show.

If you use Charts now, Chartwork is meant to read Charts' `chart` blocks and `window.renderChart` calls as they are, so switching shouldn't mean editing your notes. How the two behave when both are installed is still open.

## Three ways to make a chart

| Way | Use it when | Needs |
|---|---|---|
| Bases view | the numbers are note properties, like books counted by status or hours summed by project | Bases, built into Obsidian |
| `chart` code block | the numbers are in no note, so you type them in | nothing else |
| JavaScript function | the numbers have to be worked out first, like notes created this month counted by tag | a plugin that runs JavaScript in notes, such as Dataview |

Most people will only need the Bases view. The other two cover what Bases can't express.

Chartwork only sees the data Obsidian passes to a view, or that a code block or script hands it. It writes nothing to your vault and makes no network requests; Chart.js 4 is bundled.

Licensed under [MIT](LICENSE).
