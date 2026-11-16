# TODO client

React UI for the TODO API. Sign up or log in, then keep notes on a sticky wall. The description is a notepad with bold, italic, underline, strikethrough, and lists. Each note has a color, a created date, and a done state. Creates, toggles, edits, and deletes update the screen immediately, then roll back if the API rejects the change.

The dev server proxies `/api` to the backend, so the browser does not call port 8000 directly. The client sends `Authorization: Bearer <token>` on every API call after login.

## Setup and run

Start the API first. From `server/`:

```bash
uvicorn app.main:app --reload --no-access-log
```

Then, from this directory:

```bash
npm install
npm run dev
```

Open http://127.0.0.1:5173.

`API_PROXY_TARGET` changes where Vite forwards `/api`. It defaults to `http://127.0.0.1:8000`. Docker Compose sets it to `http://api:8000`.

From the repository root, `docker compose up --build` starts PostgreSQL, the API, and this UI. The UI is at http://localhost:5173.

## Checks

```bash
npm run typecheck
npm run build
```

## Assumptions and limitations

- The login token is stored in the browser under `localStorage` key `token`. Log out removes it. The API does not keep a server-side session, so a copied token works until it expires.
- The last email and name are remembered in `localStorage` so the login form can greet you. The passcode is not stored.
- Sign up waits for **Create account**. Typing the 6 digits does not submit that form. Log in submits when you press **Log in**.
- The sticky wall is the first screen. **New task** is the tab on the right.
- Search matches the title and the note text in the browser. It is not sent to the API as a query parameter. All, Open, and Done still come from the API.
- The UI loads every task that matches the current filter. It does not page, because the wall is meant to show the whole list. The API still supports `limit` and `offset`.
- Marking a note done or not done asks for confirmation. Delete does not.
- Light and dark mode are stored in `localStorage` under `theme`.
- The Docker image runs the Vite dev server, which is appropriate for a local demo and not a production static host.
