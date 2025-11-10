# Disavow Tool

Disavow Tool is a single-page, static-export friendly app for auditors who need to turn chaotic backlink dumps into clean, Google-ready `domain:` directives. Built with the T3 stack (Next.js App Router + Tailwind 4 + tRPC), it runs entirely client-side—paste, process, and download without exposing data to a server.

## Highlights

- **Batch ingestion** – paste text or upload `.txt/.csv/.tsv` files full of URLs/domains.
- **Smart formatting** – auto-normalizes to `domain:host.com`, trims query/path noise, and can skip non-URL lines.
- **Safety filters** – require UTF-8, deduplicate results, and maintain a “greenlist” (via file upload or inline paste) to shield trusted domains.
- **Stats & status** – live counters show how many lines were skipped as plain text, rejected as duplicates, or removed via the greenlist, with a status bar summarizing every transform.
- **Export control** – add a project name, customize the filename, copy to clipboard, or download a `.txt`; built-in warning if you try to export without a greenlist.
- **Static hosting ready** – `next.config.js` uses `output: "export"` so the site can be pushed directly to GitHub Pages or any CDN.

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

- Paste or upload `.txt/.csv/.tsv` source lists.
- Toggle dedupe, skip non-URL lines, enforce UTF-8, and add a custom comment line for the first row.
- Maintain a greenlist (upload or paste) so safe domains never show up in the output; warned if exporting without one.
- Live stats show skipped plain text, deduplicated entries, and greenlist removals; preview, copy, and download actions respect custom filenames.
