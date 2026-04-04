# Netlify Jira Dashboard

The Jira dashboard now runs from a Netlify Function instead of Firebase Functions.

## Required production env vars

- `JIRA_BASE_URL`
- `JIRA_USERNAME`
- `JIRA_PASSWORD`

## Test / preview mode

Set `JIRA_DASHBOARD_USE_MOCK=true` to serve mock dashboard data without calling Jira.

The included `netlify.toml` already enables mock mode for:

- deploy previews
- branch deploys

Production keeps `JIRA_DASHBOARD_USE_MOCK=false`.

## Local development

Run the site through Netlify so the frontend and function share the same origin:

```bash
npx netlify dev
```

The app will be available on `http://localhost:8888`, and the Jira function will be served from:

```text
/.netlify/functions/jiraDashboard
```
