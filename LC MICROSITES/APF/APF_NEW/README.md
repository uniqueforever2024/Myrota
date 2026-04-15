# APF_NEW

React migration of the legacy APF HTML/CSS website.

## What this includes

- Oracle-backed APF directory data loaded through the shared `/api` workspace endpoints
- React navigation for BU, language, sections, and content views
- In-app directory manager to add, edit, and remove entries instantly
- Bulk template download/import for partner updates
- Central target connection defaults for production paths

## Available scripts

### `npm start`

Runs the app in development mode.

### `npm run build`

Builds the app for production.

## Notes

- The APF UI reads and writes live data through the Oracle workspace API.
- Default production-path links resolve to `http://frb2bcdu01.groupecat.com:8000`.
- Full URLs to other hosts are preserved as-is.
