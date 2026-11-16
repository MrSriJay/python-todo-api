# TODO API server

Python 3.11+ FastAPI service. Each person has an account. Task requests require a JWT. Titles and descriptions are encrypted before they are written to the database. Configuration comes from environment variables. Copy `.env.example` to `.env` when you want PostgreSQL. If `DATABASE_URL` is unset, the app uses a SQLite file at `server/todo.db`.

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

Create an account, then create a task with the token:

```bash
curl.exe -s -H "Content-Type: application/json" ^
  -d "{\"name\":\"Ada\",\"email\":\"ada@example.com\",\"passcode\":\"123456\"}" ^
  http://127.0.0.1:8000/api/auth/signup
```

```bash
curl.exe -s -H "Content-Type: application/json" -H "Authorization: Bearer TOKEN" ^
  -d "{\"title\":\"Buy milk\",\"description\":\"Oat\"}" ^
  http://127.0.0.1:8000/api/todos
```

On Windows PowerShell, use `curl.exe`. PowerShell's `curl` is a different command.

## Migrations

Alembic reads `DATABASE_URL` from the environment, then from `.env`, then falls back to `sqlite:///./todo.db`.

```bash
alembic upgrade head
alembic downgrade base
```

| Revision | What it does |
| --- | --- |
| `0001_create_todos` | Creates `todos` |
| `0002_add_todo_color` | Adds the sticky-note `color` column |
| `0003_users_and_encryption` | Creates `users`, deletes existing todos, stores titles as text, and requires `user_id` |

Apply migrations before starting the API. The Docker image does this on startup. The app does not create tables itself. Revision `0003` removes every existing todo so the new `user_id` column can be required. Sign up again after that migration.

## Database connection

Preferred: PostgreSQL 16.

```text
DATABASE_URL=postgresql+psycopg://todo:todo@localhost:5433/todo
```

`postgresql://` and `postgres://` URLs are rewritten to the `postgresql+psycopg` driver.

**Docker.** From the repository root, `docker compose up --build` starts PostgreSQL, the API, and the React UI. The published database port is `5433`, with user `todo`, password `todo`, and database `todo`. Port `5433` is used on the host so it does not collide with a PostgreSQL install already listening on `5432`. Inside Docker the API connects to `database:5432`.

**Local PostgreSQL.** Create a database and user, set `DATABASE_URL` to that instance, and run `alembic upgrade head`. A typical local URL is `postgresql+psycopg://todo:todo@localhost:5432/todo` when PostgreSQL is already on port 5432.

**Hosted PostgreSQL.** Set `DATABASE_URL` to the provider's connection string and use the `postgresql+psycopg` driver. Run `alembic upgrade head` against that database before starting Uvicorn. Set `JWT_SECRET` and `NOTE_ENCRYPTION_KEY` to values you keep private. Changing `NOTE_ENCRYPTION_KEY` makes notes saved with the previous key unreadable.

SQLite is supported for local development and for the automated tests:

```text
DATABASE_URL=sqlite:///./todo.db
```

Tests do not use that file. They open a private in-memory SQLite database, except for the migration test and the restart test, which use temporary files.

Other settings, also listed in `.env.example`:

| Variable | Default | Purpose |
| --- | --- | --- |
| `LOG_LEVEL` | `INFO` | Python logging level. Logs are JSON on stdout. |
| `CORS_ORIGINS` | `*` | Comma-separated browser origins allowed to call the API. |
| `JWT_SECRET` | a local development value | Signs login tokens. Use a long private value before sharing the app. |
| `JWT_EXPIRE_MINUTES` | `10080` (7 days) | How long a token stays valid. |
| `NOTE_ENCRYPTION_KEY` | a local Fernet key | Encrypts titles and descriptions at rest. |

## Tests

From this directory, after installing the `dev` extra:

```bash
pytest
ruff check .
ruff format --check .
mypy app
```

`pytest` covers signup and login, the 6-digit passcode rule, duplicate email, missing and invalid tokens, encrypted storage, a missing TODO (`404`), validation failures (`422`), filtering, sorting, pagination headers, migration upgrade/downgrade, passcode reset, and the rule that unexpected errors do not return a stack trace. The suite does not need a running PostgreSQL server.

## Assumptions and limitations

- Signup takes a name, an email, and a passcode of exactly 6 digits. The passcode is stored as a bcrypt hash. It is never returned by the API.
- Login takes the email and passcode. A wrong pair returns `401` and `{"detail": "Email or passcode is incorrect"}`. A duplicate email returns `409`.
- Every `/api/todos` route requires `Authorization: Bearer <token>`. `GET /health` is public. A missing token returns `401` and `{"detail": "Not authenticated"}`. A bad or expired token returns `401` and `{"detail": "Invalid or expired token"}`.
- Todos belong to the account in the token. Another account's todo is `404` with `{"detail": "TODO not found"}`.
- Titles and descriptions are encrypted with Fernet using `NOTE_ENCRYPTION_KEY` before they are stored. The API decrypts them only when it builds a response. A blank description stays `null`. The key is not derived from the passcode and is not placed in the JWT.
- Changing `NOTE_ENCRYPTION_KEY` or `JWT_SECRET` does not rewrite existing rows. Old notes cannot be decrypted with a new key, and old tokens fail after the secret changes.
- `POST /api/auth/passcode` changes the passcode for the logged-in account. It needs the current passcode and a different 6-digit passcode.
- IDs are integers. `title` is required, trimmed, and limited to 200 characters of plaintext. `description` is optional, trimmed, and limited to 2000 characters of plaintext. Those limits are checked before encryption. The database stores the ciphertext in a `text` column.
- New todos start with `done: false` and `color: "sun"`. Colors are `sun`, `sky`, `blush`, `peach`, and `leaf`. Clients cannot set `done` on create or on `PUT`. `PATCH /api/todos/{id}/done` flips the current value.
- `PUT` changes only the fields included in the body (`title`, `description`, `color`). An empty object is rejected.
- `GET /api/todos` returns a JSON array of the current user's todos. Without `limit`, every matching row is returned. With `limit`, the page size is 1 to 100. `offset` skips rows. Default sort is `created_at desc`, with `id` ascending as a tiebreaker. Sort fields are `created_at`, `updated_at`, and `title`. Title sort decrypts the user's matching rows and sorts them in Python, because the stored title is ciphertext.
- Timestamps are UTC. Tokens last 7 days unless `JWT_EXPIRE_MINUTES` is set.
- Concurrent toggles are last-write-wins.
- SQLite does not enforce string length. The API validation still does.
