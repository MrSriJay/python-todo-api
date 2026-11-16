# User guide

This guide is for running the TODO app and using it. You do not need to change code.

## What you can do

- Add a task with a title and an optional note
- Format the note: bold, italic, underline, strikethrough, bullet list, numbered list
- Edit the title or the note
- Mark a task done or not done
- Delete a task
- Show all tasks, only open tasks, or only finished tasks
- Sort by newest, oldest, or title

Finished tasks are faded and crossed out. The list updates immediately. If the server rejects the change, the screen returns to the previous value and shows the reason.

![Tasks screen](ui.png)

![Notepad while editing a note](editor.png)

## Start the app

1. Start Docker Desktop and wait until it is running.
2. Open a terminal in the project folder `TODO API`.
3. Run:

```bash
docker compose up --build
```

4. Wait until the API log says it is running.
5. Open http://localhost:5173

The first start downloads images, so it takes longer. Later starts are faster.

Leave that terminal open. Stopping it with Ctrl+C stops the app. To remove the containers as well:

```bash
docker compose down
```

Tasks stay in the database volume. `docker compose down` does not delete them. `docker compose down -v` does.

## Use the screen

**Add a task.** Type a title. The description can be left empty. Press **Add task**. A title that is empty or only spaces is rejected.

**Format a note.** The description is a notepad. The buttons are bold, italic, underline, strikethrough, bullet list, numbered list, and clear formatting. Select words, then press a button. In the note, Ctrl+B is bold, Ctrl+I is italic, and Ctrl+U is underline. The task list shows the same formatting. The counter under the note is the stored length, and the limit is 2000 characters.

**Complete a task.** Press the round checkbox. Press it again to mark the task open.

**Edit a task.** Press **Edit**. The notepad opens with the formatting kept. Change the title or the note, then **Save**. **Cancel** discards the edit. Clearing the note removes it.

**Delete a task.** Press **Delete**. The row leaves the list. This cannot be undone from the screen.

**Filter.** **All** shows every task. **Open** shows tasks that are not done. **Done** shows finished tasks.

**Sort.** **Newest** and **Oldest** use the time the task was created. **Title** sorts A to Z.

A red banner is the error from the API. A spinner means the first load is still in progress.

## Look at the API

Interactive docs are at http://localhost:8000/docs. The health check is http://localhost:8000/health.

Create a task:

```bash
curl -X POST http://127.0.0.1:8000/api/todos -H "Content-Type: application/json" -d "{\"title\": \"Buy milk\", \"description\": \"Oat\"}"
```

List tasks:

```bash
curl http://127.0.0.1:8000/api/todos
```

On Windows PowerShell, use `curl.exe`. PowerShell's `curl` is a different command.

| Action | Method and path | Success |
| --- | --- | --- |
| List, with optional filter and sort | GET /api/todos | 200 |
| Get one task | GET /api/todos/{id} | 200 |
| Create | POST /api/todos | 201 |
| Edit title and description | PUT /api/todos/{id} | 200 |
| Flip done | PATCH /api/todos/{id}/done | 200 |
| Delete | DELETE /api/todos/{id} | 204 |

List filters and sorting:

- `done=true` or `done=false`
- `sort=created_at`, `sort=updated_at`, or `sort=title`
- `order=asc` or `order=desc`
- `limit` from 1 to 100, and `offset`

The list body is a JSON array. `X-Total-Count` is the number of matches, not just the page. Omit `limit` to get every match.

A missing task returns 404 and `{"detail": "TODO not found"}`. A bad body returns 422 and a `detail` string that says what is wrong.

## Open the database in pgAdmin

The Docker database is on port **5433**. Port 5432 is often a PostgreSQL server already installed on Windows, and that server will reject the password `todo`.

| Field | Value |
| --- | --- |
| Host | 127.0.0.1 |
| Port | 5433 |
| Database | todo |
| Username | todo |
| Password | todo |

In pgAdmin: **Register**, then **Server**. Enter the values on the **Connection** tab. The rows are under **Databases**, **todo**, **Schemas**, **public**, **Tables**, **todos**.

These credentials are for this local Docker database only.

## Run without Docker

Use this when you want the API on your own Python install. Python 3.11 or newer is required.

```bash
cd server
python -m venv .venv
.venv\Scripts\activate
python -m pip install -e ".[dev]"
alembic upgrade head
uvicorn app.main:app --reload --no-access-log
```

With no `.env` file, the API uses a SQLite file at `server/todo.db`. To use the Docker database instead, set:

```text
DATABASE_URL=postgresql+psycopg://todo:todo@localhost:5433/todo
```

Then, in another terminal:

```bash
cd client
npm install
npm run dev
```

Open http://127.0.0.1:5173. More detail is in `server/README.md` and `client/README.md`.

## If something fails

| What you see | What to do |
| --- | --- |
| Docker says the daemon is not running | Start Docker Desktop and wait until it is ready |
| pgAdmin says password authentication failed | Use port 5433 and host 127.0.0.1, not port 5432 |
| The UI says it cannot reach the API | Keep `docker compose up` running, then reload http://localhost:5173 |
| The task list is empty | Add a task. An empty database has no rows until you do |
| Port 8000 or 5173 is already in use | Stop the other program using that port, then start Compose again |
