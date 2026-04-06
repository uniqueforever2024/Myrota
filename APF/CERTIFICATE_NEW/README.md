# CERTIFICATE_NEW

Oracle-backed certificate workspace used by the portal.

## Current mode

- No login page
- Oracle database persistence for certificate tracking
- Static workspace with direct access plus API endpoints
- Works from the APF portal route and from the standalone server

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
- `GET /api/certificates`
- `POST /api/certificates`
- `PUT /api/certificates/:id`
- `DELETE /api/certificates/:id`

## Notes

- The portal remains open-access for now.
- Certificate records are stored in the `MYROTA_CERTIFICATE` Oracle table.
- Upload metadata and file data are saved with the certificate record.
