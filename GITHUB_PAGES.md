# GitHub Pages Deployment

This repo now includes a static dashboard entry at `index.html` for GitHub Pages.

## Publish

1. Push this repo to GitHub.
2. In GitHub, open `Settings > Pages`.
3. Under `Build and deployment`, choose:
   - `Source`: `Deploy from a branch`
   - `Branch`: `main` (or your active branch)
   - `Folder`: `/ (root)`
4. Save and wait for GitHub Pages to publish.

Your site will be available at a URL like:

`https://<your-username>.github.io/<repo-name>/`

## Backend API

The static dashboard reads data from your Apps Script web app:

`https://script.google.com/macros/s/AKfycbw02u0lfRRc7m1F39yvhmeSadJGwbO0dqWkY_eS-IzrVQUrfQ6zvSBfAhiUC9MVZDZe/exec`

If you redeploy Apps Script and get a new `/exec` URL, you have two options:

1. Update `DEFAULT_WEB_APP_URL` in `index.html`
2. Override it from the browser using:

`?api=<your-new-encoded-exec-url>`

Example:

`https://<your-username>.github.io/<repo-name>/?api=https%3A%2F%2Fscript.google.com%2Fmacros%2Fs%2FNEW_DEPLOYMENT_ID%2Fexec`

The override is saved in `localStorage` for later visits.
