# CERTIFICATE_NEW

Open certificate workspace used during the build phase of the portal.

## Current mode

- No login page
- No database dependency yet
- No SSH tunnel dependency
- Static Express workspace with direct access
- Local browser storage for certificate tracking until DB hookup is added

## Run

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the workspace:
   ```bash
   npm start
   ```
3. Open:
   `http://localhost:3003`

## API

- `GET /api/health`

## Notes

- This project is intentionally open-access for now so the portal can be developed without backend blockers.
- The portal now includes a dashboard for `30 day`, `15 day`, and `expired` certificate alerts.
- New certificate tracking entries are stored in browser storage for now.
- The upload control is present as a UI placeholder and can be connected to database storage later.
- Secure authentication and database storage can be added back later once the pages and flows are finalized.
