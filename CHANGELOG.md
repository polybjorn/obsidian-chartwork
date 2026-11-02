# Changelog

All notable changes to this project are documented here. Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
