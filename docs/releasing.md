# Testing and releasing

## Running a build in Obsidian

The vault's `.obsidian/plugins/chartwork` folder is a symlink to this
checkout, so `npm run build` here is what Obsidian loads. Hot Reload
(pjeby/hot-reload) reloads the plugin when `main.js` changes, because the
folder holds a `.git`. Without it, toggle the plugin off and on.

A build made in a git worktree is invisible until copied into the main
checkout: `npm run preview` builds and copies `main.js`, plus `styles.css`
when the branch changed it (undo that with `git restore styles.css` in the
main checkout).

## Test plan before a tag

CI never runs Obsidian, so run these against the build about to be tagged:

1. `npm run build` is clean and the plugin reloads without a console error.
2. A Bases chart view, a `chart` block drawn from a table, one from a CSV
   file and one with inline data, and a script chart through both
   `chartwork.render` and `window.renderChart` all draw.
3. Switching between light and dark recolors every chart without a reload,
   and changing the text size resizes chart text.
4. Editing the table or CSV file a chart reads redraws it.
5. "Check chart blocks and scripts" runs and reports the notes it should.
6. Export a note with charts to PDF: every chart prints.
7. When the change touches an Obsidian API, repeat 1 and 2 on the stable
   release in a separate profile (`--user-data-dir`) with `docs/demo-vault`,
   since `minAppVersion` stays at stable.
