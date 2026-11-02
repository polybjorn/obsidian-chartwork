# Releasing

Running a build in Obsidian is in [CONTRIBUTING.md](../CONTRIBUTING.md).

## Test plan before a tag

CI never runs Obsidian, so run these against the build about to be tagged:

1. `npm run build` is clean and the plugin reloads without a console error.
2. Open every note in `docs/demo-vault/Gallery`: every chart draws, and each
   Mistakes chart shows the error its note names. Then check that a Bases
   chart view, a `chart` block drawn from a table, one from a CSV file and one
   with inline data, and a script chart through both `chartwork.render` and
   `window.renderChart` all draw. The script charts need Dataview, in the demo
   vault or in another vault holding the same charts.
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
    release and on the oldest release at or above `minAppVersion`, each in a
    separate profile (`--user-data-dir`) with `docs/demo-vault`. Before 1.13
    the settings tab draws from `display()`, not from its setting definitions.
    Older installers are on the `obsidianmd/obsidian-releases` GitHub
    releases; a fresh profile runs the version the installer shipped, not a
    downloaded update.

## Release

The forge's `github-sync` job copies `main` and each tag to GitHub. A tag landing there starts `.github/workflows/release.yml`, which runs lint and tests, builds, attests the build and uploads `main.js`, `manifest.json` and `styles.css` to a GitHub release. The tag's section in `CHANGELOG.md` becomes the release notes. A stable tag has to be on `main` and equal the `manifest.json` version, with no `v`, or the workflow stops before building.

1. Run the test plan above.
2. Rename `## [Unreleased]` in `CHANGELOG.md` to `## [X.Y.Z] - YYYY-MM-DD`.
3. `npm version X.Y.Z --git-tag-version=false` sets the version in `package.json`, `manifest.json` and `versions.json`.
4. Commit, tag and push:

   ```sh
   git add CHANGELOG.md package.json package-lock.json manifest.json versions.json
   git commit -m "chore: release X.Y.Z"
   git tag -a X.Y.Z -m "X.Y.Z"
   git push origin main X.Y.Z
   ```

## Beta releases

A tag like `1.1.0-beta.1` publishes a GitHub pre-release that only [BRAT](https://github.com/TfTHacker/obsidian42-brat) users get. Obsidian's updater reads `manifest.json` on `main` and fetches the release it names, so a beta reaches nobody else while `main` stays at the last stable version.

1. Add a `## [1.1.0-beta.1]` section to `CHANGELOG.md` above the last release. It becomes the release notes; without one, GitHub writes them from the commits.
2. Tag the commit to test, on `main` or on a branch not merged yet, without bumping the version: `git tag -a 1.1.0-beta.1 -m 1.1.0-beta.1 && git push origin <branch> 1.1.0-beta.1`. The branch goes in the same push, because the forge's GitHub sync finds the tagged commit only on a branch it holds; a tag pushed alone fails that job, and a rerun after pushing the branch syncs it. Don't run `npm version`, which writes `manifest.json` and `versions.json`. The release workflow sets the version in the uploaded `manifest.json`.
3. Testers run "BRAT: Add a beta plugin for testing" with `polybjorn/obsidian-chartwork` and pick the beta. BRAT then follows each new one.
4. For the stable release, fold the beta sections into one `## [1.1.0]` section and release as above.
