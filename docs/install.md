# Installation

Chartwork is in the [Obsidian community directory](https://community.obsidian.md/plugins/chartwork). It needs Obsidian 1.10.2 or later, on desktop or mobile.

## Community plugins browser

1. Open Settings, then Community plugins. If this is your first community plugin, turn off Restricted mode when asked.
2. Select Browse and search for "Chartwork".
3. Select Install, then Enable.

## Manual install

For an offline install or a specific version:

1. Download `main.js`, `manifest.json` and `styles.css` from the [release](https://github.com/polybjorn/obsidian-chartwork/releases) you want.
2. In your vault, create the folder `.obsidian/plugins/chartwork/` and copy the three files into it.
3. In Settings, Community plugins, reload the list and enable Chartwork.

Obsidian's updater replaces a manual install when a newer release comes out.

## Beta versions

Betas are GitHub pre-releases, which Obsidian's updater never offers. To try one, install [BRAT](https://community.obsidian.md/plugins/obsidian42-brat), run "BRAT: Add a beta plugin for testing", enter `polybjorn/obsidian-chartwork` and pick the latest version. BRAT then follows each new beta. Once the stable release is out, pick it in BRAT or remove Chartwork from BRAT's list, and Obsidian's updater takes over.

## Moving from Charts

Notes written for the Charts plugin draw unchanged in Chartwork. While Charts is enabled it keeps drawing the `chart` blocks, so disable it and reload Obsidian. Then run the command "Check chart blocks and scripts", which lists any block or script that needs a change.
