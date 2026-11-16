# TODO client

React UI for the TODO API. It lists every matching task, adds tasks, edits the title and description, toggles done, and deletes. The description is a notepad with bold, italic, underline, strikethrough, and lists. Completed tasks are faded and struck through. Creates, toggles, edits, and deletes update the list immediately, then roll back if the API rejects the change.

The dev server proxies `/api` to the backend, so the browser does not call port 8000 directly.

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

- The UI loads every task that matches the current filter. It does not page, because the screen is meant to show the whole list. The API still supports `limit` and `offset`.
- Filter and sort are sent to the API. The list is not filtered again in the browser.
- There is no login. Everyone using the API sees the same tasks.
- The Docker image runs the Vite dev server, which is appropriate for a local demo and not a production static host.
