# TODO API server

Python 3.11+ FastAPI service for the TODO API. Configuration comes from environment variables. Copy `.env.example` to `.env` when you want PostgreSQL. If `DATABASE_URL` is unset, the app uses a SQLite file at `server/todo.db`.

## Setup and run

From this `server` directory:

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -e ".[dev]"
alembic upgrade head
uvicorn app.main:app --reload --no-access-log
```

```bash
python3.12 -m venv .venv
source .venv/bin/activate
python -m pip install -e ".[dev]"
alembic upgrade head
uvicorn app.main:app --reload --no-access-log
```

The API listens on http://127.0.0.1:8000. Interactive docs are at http://127.0.0.1:8000/docs and the OpenAPI schema is at http://127.0.0.1:8000/openapi.json.

Create a task:

```bash
curl -X POST http://127.0.0.1:8000/api/todos \
  -H "Content-Type: application/json" \
  -d "{\"title\": \"Buy milk\", \"description\": \"2% or oat\"}"
```

On Windows PowerShell, prefer `curl.exe` so the command is not aliased to `Invoke-WebRequest`.

## Migrations

Alembic reads `DATABASE_URL` from the environment, then from `.env`, then falls back to `sqlite:///./todo.db`.

```bash
alembic upgrade head
alembic downgrade base
```

The initial revision creates the `todos` table. Apply migrations before starting the API. The Docker image does this on startup. The app does not create tables itself.

## Database connection

Preferred: PostgreSQL 16.

```text
DATABASE_URL=postgresql+psycopg://todo:todo@localhost:5432/todo
```

`postgresql://` and `postgres://` URLs are rewritten to the `postgresql+psycopg` driver. From the repository root, `docker compose up --build` starts PostgreSQL and the API together. The published database port is `5432`, with user `todo`, password `todo`, and database `todo`. Those values are for local development.

SQLite is supported for local development and for the automated tests:

```text
DATABASE_URL=sqlite:///./todo.db
```

Tests do not use that file. They open a private in-memory SQLite database, except for the migration test and the restart test, which use temporary files.

Other settings:

| Variable | Default | Purpose |
| --- | --- | --- |
| `LOG_LEVEL` | `INFO` | Python logging level. Logs are JSON on stdout. |
| `CORS_ORIGINS` | `*` | Comma-separated browser origins allowed to call the API. |

## Tests

From this directory, after installing the `dev` extra:

```bash
pytest
ruff check .
ruff format --check .
mypy app
```

`pytest` covers the happy paths, a missing TODO (`404`), validation failures (`422`), filtering, sorting, pagination headers, migration upgrade/downgrade, and the rule that unexpected errors do not return a stack trace.

## Assumptions and limitations

- The API is a single shared list. There is no authentication or per-user ownership, because the assignment does not ask for either.
- IDs are integers.
- `title` is required, trimmed, and limited to 200 characters. `description` is optional, trimmed, limited to 2000 characters, and stored as `null` when blank.
- New todos start with `done: false`. Clients cannot set `done` on create or on `PUT`. `PATCH /api/todos/{id}/done` flips the current value.
- `PUT` changes only the fields included in the body. An empty object is rejected.
- `GET /api/todos` returns a JSON array. Without `limit`, every matching row is returned. With `limit`, the page size is 1 to 100. `offset` skips rows. Default sort is `created_at desc`, with `id` ascending as a tiebreaker. Sort fields are `created_at`, `updated_at`, and `title`.
- Timestamps are UTC.
- Concurrent toggles are last-write-wins.
- PostgreSQL enforces the 200-character title column. SQLite does not enforce `VARCHAR` length; the API validation still does.
- The React UI in `client/` is optional. Swagger at `/docs` and curl still exercise the API directly.
