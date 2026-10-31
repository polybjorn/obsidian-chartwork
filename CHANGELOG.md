# Changelog

All notable changes to this project are documented here. Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

The first release. Where an entry answers a request still open on another chart plugin, it links to it.

### Added

- **Bases chart view.** Bar, line, pie, doughnut and scatter charts from note properties. It counts notes or takes the sum, average, minimum or maximum of a property ([Tracker #66](https://github.com/pyrochlore/obsidian-tracker/issues/66), [Tracker #410](https://github.com/pyrochlore/obsidian-tracker/issues/410)), and groups dates by day, week, month or year on a time axis ([Bases Charts #22](https://github.com/mProjectsCode/obsidian-bases-charts-plugin/issues/22), [Bases Charts #21](https://github.com/mProjectsCode/obsidian-bases-charts-plugin/issues/21)).
- Bases view options: sort ([Bases Charts #5](https://github.com/mProjectsCode/obsidian-bases-charts-plugin/issues/5)), an order to put first, the largest few with the rest added up, a color per category ([Bases Charts #3](https://github.com/mProjectsCode/obsidian-bases-charts-plugin/issues/3)), running totals, horizontal bars, a value-axis range, an average line ([Bases Charts #9](https://github.com/mProjectsCode/obsidian-bases-charts-plugin/issues/9)) and line smoothing ([Bases Charts #7](https://github.com/mProjectsCode/obsidian-bases-charts-plugin/issues/7)). A grouped base draws one series per group.
- Scatter charts in the Bases view name the note on hover ([Bases Charts #13](https://github.com/mProjectsCode/obsidian-bases-charts-plugin/issues/13)) and can size points by a property ([Bases Charts #12](https://github.com/mProjectsCode/obsidian-bases-charts-plugin/issues/12)).
- **`chart` code block** in Charts' format, so a Charts note draws as it is, on Chart.js 4. Data can come from the block, a table in the note or a CSV file ([Charts #17](https://github.com/phibr0/obsidian-charts/issues/17)), with chosen rows or columns ([Charts #66](https://github.com/phibr0/obsidian-charts/issues/66)). New keys add values on bars and slices ([Charts #39](https://github.com/phibr0/obsidian-charts/issues/39), [Charts #116](https://github.com/phibr0/obsidian-charts/issues/116)), reference lines ([Charts #133](https://github.com/phibr0/obsidian-charts/issues/133)), an average line, a running total, and a height and width.
- **Script function** `window.chartwork.render`, plus `window.renderChart` for scripts written for Charts, in theme colors ([Charts #103](https://github.com/phibr0/obsidian-charts/issues/103)) and with a width and height in the spec ([Charts #64](https://github.com/phibr0/obsidian-charts/issues/64)). Works with any plugin that runs JavaScript in notes, such as Dataview ([Tracker #88](https://github.com/pyrochlore/obsidian-tracker/issues/88)).
- Theme colors and text size in every chart, redrawn when the theme switches between light and dark.
- The command **Check chart blocks and scripts** lists notes with charts Chartwork can't draw as written.
- Chart.js 4 with its sankey and annotation plugins bundled; nothing is fetched from the network.
