# Changelog

All notable changes to this project are documented here. Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0] - 2026-11-07

### Added

- `time: month` in a `chart` block, as Charts writes it, draws dated labels on a date axis in steps of a day, week, month or year, the same as `dateUnit` in a script.
- A Group colors option in the Bases view pins a grouped bar, line or scatter chart's series to colors by group name.

### Changed

- On a date axis, hovering a point dated partway through its unit, such as 2026-08-22 under `dateUnit: "month"`, shows the full date instead of only the month or year.
- Charts in an exported PDF are drawn at 300 ppi or more instead of the screen's pixel ratio, so they stay sharp when the PDF is zoomed in.

## [1.1.0] - 2026-11-06

### Added

- Hovering a scatter point in the Bases view shows its point size value.
- A Value labels option in the Bases view, with Automatic, On and Off, the same as `valueLabels` in a `chart` block.
- A Stacked option in the Bases view for bar and line charts, the same as `stacked: true` in a `chart` block.
- Hovering a stacked bar or line chart shows the total of its series.
- A chart block with a key neither Chartwork nor Charts knows, or a Chartwork key its chart type does not use, shows a line under the chart naming it, with a guess for a misspelt key. A script spec field the chart's kind does not use, such as `horizontal` on a pie, shows the same line.
- Right-clicking a chart offers **Copy chart as image**, a PNG on the theme's background.
- A click on a bar, slice or point in a Bases chart opens the notes behind it.

### Changed

- Tooltips no longer show a color key, and scatter tooltips name the group in text.
- A hidden series or slice is grayed out in the legend instead of struck through.
- A bar chart's tooltip sits beside the bar, level with its middle, instead of at its top.
- Tooltips have a thin outline, so they stand out on a dark note.
- Line chart points are easier to hit, with a finger above all.
- A script spec with unknown fields throws one error naming all of them, with the valid fields, instead of stopping at the first.

### Fixed

- A chart scrolled past quickly in reading view no longer comes back blank, or logs an error when hovered.
- Scrolling up past charts in reading view no longer makes the note jump.
- A pattern for reading table rows no longer risks stopping the plugin from loading on iOS before 16.4.

## [1.0.3] - 2026-11-03

### Fixed

- A Bases chart played its opening animation twice after each change to the view's options.

## [1.0.2] - 2026-11-03

### Removed

- **Copy as Markdown** in the check command's report. The report's text can still be selected and copied.

## [1.0.1] - 2026-11-02

### Fixed

- The release files carry a build attestation that verifies against the public Sigstore log, and the source builds without a git checkout.

## [1.0.0] - 2026-11-02

The first release.

### Added

- **Bases chart view.** Bar, line, pie, doughnut and scatter charts from note properties. It counts notes or takes the sum, average, minimum or maximum of a property, and groups dates by day, week, month or year on a time axis.
- Bases view options: sort, an order to put first, the largest few with the rest added up, a color per category, running totals, horizontal bars, a value-axis range, an average line and line smoothing. A grouped base draws one series per group.
- Scatter charts in the Bases view name the note on hover and can size points by a property.
- **`chart` code block** in Charts' format, so a Charts note draws as it is, on Chart.js 4. Data can come from the block, a table in the note or a CSV file, with chosen rows or columns. New keys add values on bars and slices, reference lines, an average line, a running total, and a height and width.
- **Script function** `window.chartwork.render`, plus `window.renderChart` for scripts written for Charts, in theme colors and with a width and height in the spec. Works with any plugin that runs JavaScript in notes, such as Dataview.
- Theme colors and text size in every chart, redrawn when the theme switches between light and dark.
- The setting **Series colors** puts your own colors before the theme's. Both settings show in Obsidian's settings search from 1.13.
- The command **Check chart blocks and scripts** lists notes with charts Chartwork can't draw as written.
- Chart.js 4.6.1 with its sankey and annotation plugins bundled; nothing is fetched from the network.
