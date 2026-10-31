# Contributing

Bug reports, fixes and focused feature PRs are welcome. The plugin has one maintainer, so open an issue before starting a larger feature.

## No code from other chart plugins

[Charts](https://github.com/phibr0/obsidian-charts) is AGPL and Bases Chart Views is GPL, so nothing is copied or translated from either. Reading their source to learn what a note expects (key names, data shapes) is fine; the code is written fresh. Where a change adds a key Charts also reads, use Charts' spelling and meaning, so a Charts note draws as it is.

## Development setup

```sh
git clone https://github.com/polybjorn/obsidian-chartwork
cd obsidian-chartwork
npm ci
```

## Running the plugin locally

The build writes `main.js` next to `manifest.json` and `styles.css`. Symlink the repo into a vault's plugin folder under the name `chartwork`, which must match `manifest.id`:

```sh
ln -s "$(pwd)" /path/to/your/vault/.obsidian/plugins/chartwork
```

Enable the plugin in Settings -> Community plugins. To load a rebuild, toggle it off and on there, or install [Hot Reload](https://github.com/pjeby/hot-reload), which reloads it whenever `main.js` changes.

In a git worktree, `npm run preview` builds and copies `main.js` into the main checkout, the folder Obsidian loads, plus `styles.css` when the branch changed it (undo that with `git restore styles.css` in the main checkout). `npm run build` in the main checkout switches back.

`docs/demo-vault` is a small vault of made-up notes with charts, including edge cases and the errors common mistakes give. Open it as a vault to try a change.

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Rebuild on every change |
| `npm run build` | Type-check, then a production build |
| `npm run preview` | Build, then copy it into the main checkout |
| `npm run lint` | ESLint with the Obsidian plugin rules |
| `npm test` | Run the tests |
| `npm run screenshots` | Render the README and docs images from `docs/demo-vault` in a separate Obsidian instance; name shots after `--` to render only those. The README's GIF needs [ffmpeg](https://ffmpeg.org) |

## Commit messages

[Conventional Commits](https://www.conventionalcommits.org/): `type: short imperative description`, where type is one of `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `ci`, `build`, `perf`, `style` or `revert`. Messages that don't fit may be rewritten when the PR lands.

## Pull requests

- Branch from `main`, one concern per PR.
- `npm run build`, `npm run lint` and `npm test` pass.
- Add tests for new or changed behavior. Tests live in `tests/` and run on `node --test`, with no framework.
- A new `chart` block key goes in `BLOCK_KEYS` in `src/codeblock/parse.ts`, which the check command reads, plus `docs/code-block.md` and a parse test. A script API change goes in `docs/script-api.md`, a Bases view option in `docs/bases-view.md`, and anything that changes what the README promises in `README.md`.
- Example data in docs and tests is made up.
- US spelling (`color`) in the interface and docs, as Obsidian's own interface uses.
- Keep the plugin working on the Obsidian version in `minAppVersion`. Feature-detect a newer API instead of raising it.
- No new runtime dependency without saying why in the PR. Niche Chart.js add-ons are not bundled; a script registers its own.
- Test in a real vault before opening the PR. CI runs lint, tests and build, but never loads the plugin in Obsidian, so list what to check there in the PR's test plan.
