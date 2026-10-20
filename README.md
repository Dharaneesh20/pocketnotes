# Pocket Notes — Vercel-only personal notebook

A minimal Markdown notebook with named workspaces, folders, pages, autosave, JSON backup/restore, and cross-device sync. The frontend is a static Vite app; a Vercel Function writes notebook data to MongoDB Atlas.

## Important privacy model

There is no login or password by design. The `workspace` query parameter is a randomly generated 192-bit bearer secret. Anyone who obtains the full workspace URL can read and edit that notebook. Do not put sensitive credentials, API keys, financial details, or private documents in it. Keep the URL private. The notebook is not encrypted end-to-end: Vercel's server function processes the content.

The browser keeps a local cache for offline viewing/editing. Automatic remote sync requires a network connection. If two devices edit simultaneously, this starter uses last-write-wins and does not merge conflicting changes. Export backups regularly.

## Deploy to Vercel

1. Create a Vercel account and a new Vercel project from this folder or its Git repository.
2. Create a MongoDB Atlas database and allow the Vercel deployment's network access according to your Atlas security policy.
3. Add `MONGODB_URI` to the Vercel project's environment variables. Optionally add `MONGODB_DB` (defaults to `pocketnotes`). Never commit the URI or put it in frontend code.
4. Deploy the project. Vercel automatically builds the Vite frontend and deploys `api/notebook.ts` as a serverless function.
5. Open the deployed URL. The app creates a workspace key and adds it as `?workspace=...`.
6. Use **Link → Copy workspace link** and open that exact link on your other devices. This is how devices access the same remote notebook.

The first deployment without `MONGODB_URI` will show local/offline status and cannot sync until the variable is configured. If a MongoDB password has been exposed, rotate it before deploying.

## Local development

Requires Node.js 20 or newer.

```bash
npm install
npm run dev
```

For local API testing, install the Vercel CLI, connect the project to Vercel, pull environment variables, then run `vercel dev`. Plain `npm run dev` only runs the frontend; `/api/notebook` will not be available through Vite.

## Features

- No accounts, passwords, or sign-in.
- Users are organizational profiles, not authenticated identities.
- Folder and page CRUD.
- Markdown editing with a sanitized preview, clipboard copy, and download.
- Debounced local save and remote sync.
- Workspace URL sharing for cross-device access.
- JSON export/import.
- Service worker caches the app shell and built assets for offline reopening.

## Limits and notes

- A notebook JSON payload is limited to 2 MB by the API.
- This version uses a single notebook JSON object per workspace and last-write-wins sync; it is intended for personal use, not collaborative multi-user editing.
- If storage quota is reached, export a backup and remove large content.
- Browser clipboard access generally requires HTTPS and may require permission.
- Do not use workspace URLs as a security boundary for confidential information.
