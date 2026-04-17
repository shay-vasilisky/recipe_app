# Recipe App

A small shared recipe web app built with React, Vite, Firebase Auth, Firestore, and GitHub Pages.

## What v1 does

- Google sign-in
- Shared recipe list for two approved accounts
- Add, edit, and delete recipes
- Open the recipe source URL
- Show an external image when present, otherwise a fallback card

## Local setup

1. Copy `.env.example` to `.env.local`.
2. Fill in the Firebase web app config values.
3. Set `VITE_ALLOWED_EMAILS` to the two Google accounts that should use the app.
4. Install dependencies with `npm install`.
5. Start the app with `npm run dev`.

## Firebase setup

### Authentication

1. Create a Firebase project.
2. Enable `Authentication` and turn on the Google provider.
3. Add your production GitHub Pages domain to Firebase Auth authorized domains.
   Example: `your-user.github.io`

### Firestore

1. Create a Firestore database.
2. Open the Firestore rules editor.
3. Paste the contents of [firestore.rules](./firestore.rules).
4. Replace the placeholder emails with the real two accounts.
5. Publish the rules.

## GitHub Pages deployment

This repo includes the official Pages workflow in [.github/workflows/deploy.yml](./.github/workflows/deploy.yml).

Before pushing to GitHub:

1. Create a public repository.
2. Add these repository secrets:
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`
   - `VITE_ALLOWED_EMAILS`
3. In GitHub Pages settings, set the source to `GitHub Actions` before the first workflow run.
4. If the first workflow run already failed before Pages was enabled, re-run the workflow after changing the Pages source.

The workflow builds with `BASE_PATH=/<repo-name>/`, so it works for a standard project Pages URL.

## Important note about Firebase config

The Firebase web config values are not private once the app is deployed in the browser. The real protection comes from:

- Google authentication
- Firestore rules restricted to the approved email allowlist
