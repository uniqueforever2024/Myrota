# APF_NEW

React + Express migration of the original `EDI_CERTIFICATE` project.

## What is included

- The original login flow moved from plain HTML/CSS/JS into React
- The same Express session authentication endpoints
- The same PostgreSQL + SSH tunnel backend structure
- A new directory manager so routes and menu items can be added or removed from the UI

## Run

1. Create `APF_NEW/.env` with the same connection values as the current project.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Initialize the database objects:
   ```bash
   npm run init-db
   ```
4. Start the React frontend and Express backend together:
   ```bash
   npm run dev
   ```
5. Open `http://localhost:5173`

## Production style run

```bash
npm run build
npm start
```

That serves the built React app from Express at `http://localhost:3000`.
