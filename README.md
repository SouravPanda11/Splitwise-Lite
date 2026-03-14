# Spliwise Lite

Static GitHub Pages trip-splitting app with:

- a public read-only viewer at `index.html`
- a private local manager at `manage.html`
- published trip data stored in `data/trip-data.json`

## Files

- `index.html`: the page you share with friends
- `manage.html`: your local editing helper
- `data/trip-data.json`: the published data source

## If you already entered data in the old version

1. Open `manage.html`.
2. Click `Import old browser data`.
3. Check the draft.
4. Click `Export JSON`.
5. Replace `data/trip-data.json` with the exported file.
6. Push the change to GitHub.

## Normal update workflow

1. Open `manage.html`.
2. Click `Load repo JSON` if you want to start from the current published file.
3. Make your changes.
4. Click `Export JSON`.
5. Replace `data/trip-data.json` in the repo with the downloaded file.
6. Push to GitHub Pages.
7. Share only `index.html` with your friends.

## Important limitation

This is still a static site. `manage.html` cannot update GitHub Pages by itself. It only helps you edit and export the JSON file. The public page changes only after you commit and push the updated `data/trip-data.json`.
