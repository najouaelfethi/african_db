# Running the project on Replit

The African Air Database web app runs with:

```sh
PORT=5000 npm run dev:web
```

The Replit workflow starts this command on port 5000. The project requires Node.js 22.18 or newer. The Vite development server proxies `/api` requests to the API host configured in `artifacts/african-air-db/vite.config.ts`.

The separate API server is not needed to run the web app. Running it locally requires a PostgreSQL `DATABASE_URL`.
