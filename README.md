# French 3000 Vocabulary App

A static French vocabulary learning app built with HTML, CSS, and vanilla JavaScript. No build tools, backend, or package installation are required.

## Project structure

```text
index.html              App shell and semantic markup
styles.css              Design tokens, layout, responsive and component styles
js/vocabulary.json      Starter vocabulary dataset
js/app.js               App state, rendering, learning flow, persistence and event wiring
js/frequency-import.js  CSV parsing, imported-word storage, and Library import UI
README.md               Setup and deployment guide
.gitignore              Common local/editor artifacts
```

## Run locally

Serve this folder with any static HTTP server. For example, from this directory run `python -m http.server 8000` and visit `http://localhost:8000`. A server is required because the app loads its vocabulary from a JSON file.

## Deploy to GitHub Pages

1. Create a GitHub repository.
2. Upload the contents of this folder to the repository root (not the parent folder).
3. Open **Settings → Pages**.
4. Under **Build and deployment**, select **Deploy from a branch**, choose `main` and `/ (root)`, then save.
5. Wait for the Pages deployment and open the URL GitHub provides.

## Maintainability notes

- Keep markup in `index.html`, visual styles in `styles.css`, app behavior in `js/app.js`, and CSV import behavior in `js/frequency-import.js`.
- Add or edit starter words in `js/vocabulary.json`. Each entry is an object with `fr`, `en`, `pos`, `level`, `cat`, and `example` string fields; the app assigns IDs at runtime.
- Browser progress uses `localStorage` and stays on the current browser/device. Export a JSON backup from Settings before clearing browser data.
- Mark words as difficult from a study card or the Word Library, then use the Difficult Words section for focused practice.
- The bundled list is starter content, not 3,000 unique entries. Use the Library CSV import to add more vocabulary; duplicate headwords are skipped.
- The app intentionally has no framework or dependency step so it remains easy to host as a static site.

## Current architecture and future improvements

The frequency-list import is isolated in `js/frequency-import.js`; the app loads saved vocabulary before its first render and mounts the import UI from the normal render flow. For a larger feature set, consider extracting storage, study-session logic, and page views into ES modules and adding automated tests before introducing a framework.
