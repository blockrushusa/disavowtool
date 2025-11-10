# Disavow Tool

A lightweight Next.js + T3 Stack UI for turning messy backlink dumps into Google-ready `domain:` directives. Paste URLs, upload files, apply dedupe/UTF-8/greenlist filters, then copy or download the formatted list.

## Available scripts

- `npm run dev` – start the local dev server with Turbopack.
- `npm run build` – create a production build (also powers static export).
- `npm run export` – identical to `npm run build`, but named for clarity when generating static assets.
- `npm run preview` – run the production server locally.
- `npm run typecheck` – ensure TypeScript types are sound.

## Exporting for GitHub Pages (or any static host)

This project is configured with `output: "export"` in `next.config.js`, so a single command produces a static site under the `out/` directory.

```bash
npm install
npm run export
```

The `out/` folder now contains HTML/CSS/JS you can upload directly to GitHub Pages (via `gh-pages`, GitHub Actions, or manual upload). If you serve the site from a sub-path (e.g., `https://username.github.io/repo-name`), remember to set the `homepage` in your deployment tooling or adjust `assetPrefix`/`basePath` if needed for your repository slug.

## Features recap

- Paste text or upload `.txt/.csv/.tsv` source lists.
- Toggle deduplication, skip non-URL lines, require UTF-8, and add a custom comment line.
- Maintain a greenlist of safe domains (upload file or paste inline) so they never appear in the disavow output.
- See a live breakdown of how many entries were skipped (plain text, duplicates, greenlist) along with export-ready previews, copy, and download actions.
