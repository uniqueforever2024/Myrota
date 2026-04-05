# APF_NEW

React migration of the legacy APF HTML/CSS website.

## What this includes

- Self-contained connection data owned by `public/APF_NEW.json`
- React navigation for BU, language, sections, and content views
- In-app directory manager to add, edit, and remove entries instantly
- Local file persistence with backup creation
- Central target connection defaults for production paths

## Available scripts

### `npm start`

Runs the app in development mode.

### `npm run build`

Builds the app for production.

## Notes

- The local save API writes updates to `public/APF_NEW.json` and keeps backups in `APF_BACKUPS`.
- Default production-path links resolve to `http://frb2bcdu01.groupecat.com:8000`.
- Full URLs to other hosts are preserved as-is.
