# Releasing

Running a build in Obsidian is in [CONTRIBUTING.md](../CONTRIBUTING.md).

## Test plan before a tag

CI never runs Obsidian, so run these against the build about to be tagged:

1. `npm run build` is clean and the plugin reloads without a console error.
2. Open every note in `docs/demo-vault/Gallery`: every chart draws, and each
   Mistakes chart shows the error its note names. Then check that a Bases
   chart view, a `chart` block drawn from a table, one from a CSV file and one
   with inline data, and a script chart through both `chartwork.render` and
   `window.renderChart` all draw.
3. Switching between light and dark recolors every chart without a reload,
   and changing the text size resizes chart text.
4. Editing the table or CSV file a chart reads redraws it.
5. "Check chart blocks and scripts" runs and reports the notes it should.
6. Export a note with charts to PDF: every chart prints.
7. On a phone, the plugin loads and a Bases chart view, a `chart` block and
   a script chart draw.
8. Switch a base from the chart view to a table view and back: the table
   keeps its own layout, with no chart styling left behind.
9. A base embedded in a canvas draws at a steady size, with no scrollbars
   and no y axis that keeps growing.
10. When the change touches an Obsidian API, repeat 1 and 2 on the stable
    release in a separate profile (`--user-data-dir`) with `docs/demo-vault`,
    since `minAppVersion` stays at stable.
