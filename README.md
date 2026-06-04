# Copy Link Button

An [Obsidian](https://obsidian.md) plugin that adds a small copy button next to
links, so you can copy a URL to your clipboard with a single click — much like
the copy button next to code blocks.

![Copy button next to a link](copy-link.png)

## Features

- Adds a copy button next to **markdown links** (`[text](https://…)`) and
  **bare URLs** (`https://…`).
- Works in both **editing / Live Preview** and **reading view**.
- Clicking the button copies the URL and briefly shows a checkmark.
- Styled with Obsidian theme variables, so it matches the external-link icon in
  light and dark themes.

Wikilinks (`[[Note]]`) are intentionally left alone.

## Installation

### From the community plugin store

Once approved: **Settings → Community plugins → Browse**, search for
"Copy Link Button", install, and enable.

### Manual

1. Download `main.js`, `manifest.json`, and `styles.css` from the
   [latest release](../../releases/latest).
2. Copy them into your vault at
   `<vault>/.obsidian/plugins/copy-link-button/`.
3. Reload Obsidian and enable the plugin under **Settings → Community plugins**.

## Development

```sh
npm install --legacy-peer-deps   # obsidian pins an exact CodeMirror peer dep
npm run dev                       # watch + rebuild main.js
```

Symlink (or copy) the repo into your vault's plugins folder to test live:

```sh
ln -s "$(pwd)" "<vault>/.obsidian/plugins/copy-link-button"
```

### Building

```sh
npm run build     # type-check + production build (main.js in repo root)
npm run package   # production build collected into dist/ for distribution
```

## Releasing

Pushing to `main` runs the release workflow. When the version in
`manifest.json` doesn't yet have a matching git tag, the workflow builds the
plugin and publishes a GitHub release (tagged with the bare version, e.g.
`1.0.0`) with `main.js`, `manifest.json`, and `styles.css` attached.

To cut a release: bump the version in `manifest.json` (and `versions.json` /
`package.json`), commit, and push to `main`.

## License

[MIT](LICENSE)
