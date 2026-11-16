# Architecture

This document describes how the TODO API is put together: the running processes, the path a request takes, and the database.

## System

Three processes run together with Docker Compose.

| Process | Address | Role |
| --- | --- | --- |
| React client | http://localhost:5173 | The screen people use |
| FastAPI | http://localhost:8000 | The HTTP API and Swagger UI |
| PostgreSQL 16 | localhost:5433 | Stored tasks |

The browser never opens port 8000 itself. The Vite dev server receives `/api` and forwards it to FastAPI. Inside Docker that target is `http://api:8000`. On a laptop it is `http://127.0.0.1:8000`.

<!-- pdf-diagram: architecture -->

```mermaid
flowchart LR
  UI["React client :5173"] -->|"HTTP /api"| API["FastAPI :8000"]
  API --> Router["routers/todos.py"]
  Router --> Schemas["schemas.py"]
  Router --> Service["services/todos.py"]
  Service --> Model["models.py"]
  Model --> DB[("PostgreSQL :5433")]
```

## Request path

1. A React event in `client/src/App.tsx` or `client/src/TaskRow.tsx` calls a function in `client/src/api.ts`.
2. `api.ts` sends JSON to `/api/todos` and reads `detail` from any error body.
3. `server/app/main.py` builds the app, loads settings from the environment, and writes JSON logs.
4. `server/app/routers/todos.py` checks the HTTP method, path, and query parameters. It sets the status code and the list headers `X-Total-Count`, `X-Offset`, and `X-Limit`.
5. `server/app/schemas.py` checks the body. A title is required, trimmed, and at most 200 characters. A description is optional, trimmed, and at most 2000 characters. A blank description is stored as null. The notepad in `client/src/NotePad.tsx` keeps bold, italic, underline, strike, and lists as the tags `strong`, `em`, `u`, `s`, `ul`, `ol`, `li`, `br`, and `div`. Any other tag is removed before save.
6. `server/app/services/todos.py` reads and writes rows. A missing id raises `TodoNotFoundError`.
7. `server/app/models.py` maps the `todos` table. SQLAlchemy commits in the service.
8. `server/app/exceptions.py` turns a missing task, a bad request, and an unexpected failure into `{"detail": "..."}`. The client does not receive a stack trace.

`PUT /api/todos/{id}` changes only the title and description fields that were sent. `done` changes only through `PATCH /api/todos/{id}/done`, which flips the current value. A new task starts with `done` false.

## Modules

| Module | Responsibility |
| --- | --- |
| `client/src/api.ts` | HTTP calls and error text |
| `client/src/App.tsx` | List, form, filters, sort, optimistic updates |
| `client/src/NotePad.tsx` | Description notepad and formatted note |
| `server/app/main.py` | App setup, CORS, health check |
| `server/app/config.py` | `DATABASE_URL`, `LOG_LEVEL`, `CORS_ORIGINS` |
| `server/app/routers/todos.py` | Routes and status codes |
| `server/app/schemas.py` | Request validation |
| `server/app/services/todos.py` | Queries and writes |
| `server/app/models.py` | Table mapping |
| `server/alembic/` | Schema migrations |
| `server/tests/` | API, validation, and migration tests |

## Database

Alembic creates the schema. The API does not create tables when it starts. The first migration is `0001_create_todos`.

<!-- pdf-diagram: database -->

```mermaid
erDiagram
  TODOS {
    int id PK
    varchar title
    text description
    boolean done
    timestamptz created_at
    timestamptz updated_at
  }
```

| Column | Type | Rules |
| --- | --- | --- |
| id | integer | Primary key, assigned by the database |
| title | varchar(200) | Required. Not blank after trimming |
| description | text | Optional. Blank becomes null |
| done | boolean | Defaults to false |
| created_at | timestamptz | Set when the row is created, UTC |
| updated_at | timestamptz | Set again on edit, toggle, and create |

Indexes `ix_todos_done` and `ix_todos_created_at` support the list filter and the default sort. PostgreSQL enforces the 200-character title. SQLite, used by the tests and by a local run without `DATABASE_URL`, does not enforce `VARCHAR` length. The API validation still does.

## Configuration

| Variable | Used by | Meaning |
| --- | --- | --- |
| `DATABASE_URL` | API and Alembic | Postgres or SQLite connection string |
| `LOG_LEVEL` | API | Python log level. Logs are JSON on stdout |
| `CORS_ORIGINS` | API | Browser origins allowed to call the API |
| `API_PROXY_TARGET` | Vite | Where `/api` is forwarded |

Docker Compose sets `DATABASE_URL` to `postgresql+psycopg://todo:todo@database:5432/todo`. Port 5432 is the port inside the Docker network. The published port on the computer is 5433, so it does not collide with a PostgreSQL install already using 5432.

## Deployment shape

`docker compose up --build` starts `database`, then `api`, then `client`. The API container runs `alembic upgrade head` before Uvicorn. Task rows live in the `todo_pg` volume, so they remain after the containers stop.

Tests do not use that database. They open a private SQLite database, and the migration test uses a temporary file.
