# MyRota

MyRota is the internal rota and operations dashboard for the LC EDI support team. The app combines rota planning, live status views, audit logging, Jira dashboards, and quick links to supporting microsites in a single React + Vite frontend deployed on Netlify.

## Core Capabilities

- Portal login for the main dashboard entry experience.
- Firestore-backed rota management with admin editing.
- Firestore-backed admin password for Edit ROTA using `users/admin`.
- Audit logs for rota changes.
- Jira dashboard and issue drill-downs via Netlify Functions.
- Quick access links to APF, SFTP, Certificate, and Documentation microsites.
- Local certificate-expiry reminders stored in browser storage.

## Tech Stack

- Frontend: React 19, Vite, Tailwind-style utility classes, custom CSS
- Data store: Firebase Firestore
- Server-side integration: Netlify Functions
- External system: Jira REST API
- Build pipeline: Vite build plus microsite copy step from `scripts/copy-microsites.mjs`

## Key Paths

- Main application: `src/App.jsx`
- Firebase setup: `src/firebase.js`
- Jira frontend client: `src/jira/`
- Netlify Jira backend: `netlify/functions/jiraDashboard.js`
- Netlify Jira helpers: `netlify/jira/`
- Build copy script: `scripts/copy-microsites.mjs`
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

The build command:

1. Builds the React app into `dist/`
2. Copies APF-related microsites into the Netlify publish folder

## Jira Environment Variables

Netlify Functions expect:

- `JIRA_BASE_URL`
- `JIRA_USERNAME`
- `JIRA_PASSWORD`
- `JIRA_DASHBOARD_USE_MOCK` for preview-mode mocking

## Oracle Environment Variables

The Oracle-backed APF microsites on Netlify expect:

- `ORACLE_USER`
- `ORACLE_PASSWORD`
- Either `ORACLE_CONNECT_STRING`, or `ORACLE_HOST` plus `ORACLE_SERVICE_NAME` / `ORACLE_SID`

Deployment note:

- Netlify environment variables only provide credentials and connection values to the function.
- The Oracle server still has to be reachable from Netlify at runtime. If the database is inside a private corporate network, VPN-only segment, or restricted firewall, the function will still fail even when the env vars are correct.
- If you currently use a short TNS alias, prefer a full Easy Connect string such as `host:1521/service_name` unless you are also supplying Oracle network config files.

## Documentation Pack

- Presentation deck: `docs/myrota-architecture-presentation.html`
- Full documentation: `docs/myrota-complete-documentation.html`

Both documents include the watermark:

`Author: Akash Satapathy on behalf of HCL`
