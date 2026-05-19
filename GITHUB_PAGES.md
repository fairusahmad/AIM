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

`https://script.google.com/macros/s/AKfycbwlVLPJG_P8zySzJlSZq3HZ1KmH-JoeKXgX67F5g6Zknlj6FgTQ7WVh-5LAd3m7Mkh8/exec`

If you redeploy Apps Script and get a new `/exec` URL later, update `WEB_APP_URL` in `index.html`, commit, and push again.
