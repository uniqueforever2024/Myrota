# MyRota

MyRota is the internal rota and operations dashboard for the LC EDI support team. The app combines rota planning, live status views, audit logging, and Jira tracking in a single React + Vite frontend deployed on Netlify.

## Core Capabilities

- Portal login for the main dashboard entry experience.
- Firestore-backed rota management with admin editing.
- Firestore-backed admin password for Edit ROTA using `users/admin`.
- Audit logs for rota changes.
- Jira epic tracking with status-grouped latest comments via Netlify Functions.

## Tech Stack

- Frontend: React 19, Vite, Tailwind-style utility classes, custom CSS
- Data store: Firebase Firestore
- Server-side integration: Netlify Functions
- External system: Jira REST API
- Build pipeline: Vite build

## Key Paths

- Main application: `src/App.jsx`
- Firebase setup: `src/firebase.js`
- Jira frontend client: `src/jira/`
- Netlify Jira backend: `netlify/functions/jiraDashboard.js`
- Netlify Jira helpers: `netlify/jira/`
- Presentation deck: `docs/myrota-architecture-presentation.html`
- Full documentation: `docs/myrota-complete-documentation.html`

## Firestore Data Used By The App

- `users/{username}`: employee master records and admin password in `users/admin`
- `rota/master`: central rota assignments
- `logs/{logId}`: audit history of rota changes
- `config/admin`: optional backup location for admin configuration

## Local Development

```bash
npm install
npm run dev
```

To run the Jira-backed Netlify function locally:

```bash
npm run netlify:dev
```

## Production Build

```bash
npm run build
```

The build command builds the React app into `dist/`.

## Jira Environment Variables

Netlify Functions expect:

- `JIRA_BASE_URL`
- `JIRA_USERNAME`
- `JIRA_PASSWORD`
- `JIRA_DASHBOARD_USE_MOCK` for preview-mode mocking

## Documentation Pack

- Presentation deck: `docs/myrota-architecture-presentation.html`
- Full documentation: `docs/myrota-complete-documentation.html`

Both documents include the watermark:

`Author: Akash Satapathy on behalf of HCL`
