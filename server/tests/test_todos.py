from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import pytest
from app.database import create_db_engine, get_db
from app.main import app
from app.models import Base, Todo
from app.schemas import TITLE_MAX_LENGTH, TodoCreate
from app.services.todos import TodoService
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session, sessionmaker


def create_todo(
    client: TestClient,
    title: str,
    description: str | None = None,
) -> dict[str, Any]:
    payload: dict[str, Any] = {"title": title}
    if description is not None:
        payload["description"] = description
    response = client.post("/api/todos", json=payload)
    assert response.status_code == 201
    body: dict[str, Any] = response.json()
    return body


def test_health(client: TestClient) -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_create_list_get_and_default_done(client: TestClient) -> None:
    created = create_todo(client, "  Buy milk  ", "  2% or oat  ")
    assert created["title"] == "Buy milk"
    assert created["description"] == "2% or oat"
    assert created["done"] is False
    assert created["created_at"].endswith("Z")
    assert created["updated_at"].endswith("Z")

    listed = client.get("/api/todos")
    assert listed.status_code == 200
    assert listed.json() == [created]
    assert listed.headers["X-Total-Count"] == "1"
    assert listed.headers["X-Offset"] == "0"
    assert "X-Limit" not in listed.headers

    fetched = client.get(f"/api/todos/{created['id']}")
    assert fetched.status_code == 200
    assert fetched.json() == created


def test_blank_description_is_stored_as_null(client: TestClient) -> None:
    created = create_todo(client, "No details", "   ")
    assert created["description"] is None


def test_create_requires_a_real_title(client: TestClient) -> None:
    missing = client.post("/api/todos", json={})
    assert missing.status_code == 422
    assert missing.json() == {"detail": "title is required"}

    blank = client.post("/api/todos", json={"title": "   "})
    assert blank.status_code == 422
    assert blank.json()["detail"] == "title must not be empty or whitespace"

    too_long = client.post("/api/todos", json={"title": "a" * (TITLE_MAX_LENGTH + 1)})
    assert too_long.status_code == 422
    assert "200" in too_long.json()["detail"]


def test_unknown_create_fields_are_rejected(client: TestClient) -> None:
    response = client.post("/api/todos", json={"title": "Task", "done": True})
    assert response.status_code == 422
    assert response.json()["detail"] == "done: Extra inputs are not permitted"


def test_invalid_json_is_a_validation_error(client: TestClient) -> None:
    response = client.post(
        "/api/todos",
        content=b"{",
        headers={"Content-Type": "application/json"},
    )
    assert response.status_code == 422
    assert response.json()["detail"] == (
        "Request body is not valid JSON: Expecting property name enclosed in double quotes"
    )


def test_get_missing_todo(client: TestClient) -> None:
    response = client.get("/api/todos/999")
    assert response.status_code == 404
    assert response.json() == {"detail": "TODO not found"}


def test_non_integer_id_is_rejected(client: TestClient) -> None:
    response = client.get("/api/todos/abc")
    assert response.status_code == 422
    assert isinstance(response.json()["detail"], str)


def test_filter_by_done(client: TestClient) -> None:
    open_todo = create_todo(client, "Open")
    done_todo = create_todo(client, "Done")
    toggled = client.patch(f"/api/todos/{done_todo['id']}/done")
    assert toggled.status_code == 200
    assert toggled.json()["done"] is True

    open_items = client.get("/api/todos", params={"done": "false"})
    finished_items = client.get("/api/todos", params={"done": "true"})
    assert [item["id"] for item in open_items.json()] == [open_todo["id"]]
    assert [item["id"] for item in finished_items.json()] == [done_todo["id"]]

    invalid = client.get("/api/todos", params={"done": "maybe"})
    assert invalid.status_code == 422
    assert isinstance(invalid.json()["detail"], str)


def test_pagination_and_sort(client: TestClient) -> None:
    create_todo(client, "b")
    create_todo(client, "c")
    create_todo(client, "a")

    page = client.get("/api/todos", params={"sort": "title", "order": "asc", "limit": 2})
    assert page.status_code == 200
    assert [item["title"] for item in page.json()] == ["a", "b"]
    assert page.headers["X-Total-Count"] == "3"
    assert page.headers["X-Limit"] == "2"
    assert page.headers["X-Offset"] == "0"

    rest = client.get(
        "/api/todos",
        params={"sort": "title", "order": "asc", "limit": 2, "offset": 2},
    )
    assert [item["title"] for item in rest.json()] == ["c"]

    empty = client.get("/api/todos", params={"offset": 10})
    assert empty.json() == []
    assert empty.headers["X-Total-Count"] == "3"

    bad_sort = client.get("/api/todos", params={"sort": "priority"})
    assert bad_sort.status_code == 422


def test_newest_todos_come_first_by_default(client: TestClient, db_session: Session) -> None:
    older = create_todo(client, "older")
    newer = create_todo(client, "newer")
    first = db_session.get(Todo, older["id"])
    second = db_session.get(Todo, newer["id"])
    assert first is not None
    assert second is not None
    first.created_at = datetime(2020, 1, 1, tzinfo=UTC)
    second.created_at = datetime(2024, 1, 1, tzinfo=UTC)
    db_session.commit()

    listed = client.get("/api/todos")
    assert [item["title"] for item in listed.json()] == ["newer", "older"]


def test_update_changes_only_provided_fields(client: TestClient, db_session: Session) -> None:
    created = create_todo(client, "Original", "Keep me")
    toggled = client.patch(f"/api/todos/{created['id']}/done")
    assert toggled.json()["done"] is True

    stored = db_session.get(Todo, created["id"])
    assert stored is not None
    stored.updated_at = datetime(2020, 1, 1, tzinfo=UTC)
    stored.created_at = datetime(2020, 1, 1, tzinfo=UTC)
    db_session.commit()

    updated = client.put(
        f"/api/todos/{created['id']}",
        json={"title": " Renamed "},
    )
    assert updated.status_code == 200
    body = updated.json()
    assert body["title"] == "Renamed"
    assert body["description"] == "Keep me"
    assert body["done"] is True
    assert body["created_at"].startswith("2020-01-01")
    assert body["updated_at"] != body["created_at"]

    cleared = client.put(
        f"/api/todos/{created['id']}",
        json={"description": "  "},
    )
    assert cleared.status_code == 200
    assert cleared.json()["description"] is None
    assert cleared.json()["title"] == "Renamed"


def test_update_validation_and_missing(client: TestClient) -> None:
    created = create_todo(client, "Task")
    empty = client.put(f"/api/todos/{created['id']}", json={})
    assert empty.status_code == 422
    assert empty.json()["detail"] == "provide title and/or description to update"

    done_field = client.put(f"/api/todos/{created['id']}", json={"done": False})
    assert done_field.status_code == 422

    missing = client.put("/api/todos/404", json={"title": "Nope"})
    assert missing.status_code == 404
    assert missing.json() == {"detail": "TODO not found"}


def test_toggle_done_flips_twice(client: TestClient) -> None:
    created = create_todo(client, "Toggle me")
    first = client.patch(f"/api/todos/{created['id']}/done")
    second = client.patch(f"/api/todos/{created['id']}/done")
    assert first.json()["done"] is True
    assert second.json()["done"] is False

    missing = client.patch("/api/todos/12345/done")
    assert missing.status_code == 404
    assert missing.json() == {"detail": "TODO not found"}


def test_delete_todo(client: TestClient) -> None:
    created = create_todo(client, "Remove me")
    deleted = client.delete(f"/api/todos/{created['id']}")
    assert deleted.status_code == 204
    assert deleted.content == b""

    missing = client.get(f"/api/todos/{created['id']}")
    assert missing.status_code == 404

    deleted_again = client.delete(f"/api/todos/{created['id']}")
    assert deleted_again.status_code == 404
    assert deleted_again.json() == {"detail": "TODO not found"}


def test_unhandled_errors_hide_internals(
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def explode(self: TodoService, *args: object, **kwargs: object) -> None:
        del self, args, kwargs
        raise RuntimeError("secret database password")

    def override_get_db() -> Any:
        yield db_session

    monkeypatch.setattr(TodoService, "list_todos", explode)
    app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(app, raise_server_exceptions=False) as raw_client:
            response = raw_client.get("/api/todos")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 500
    assert response.json() == {"detail": "Internal server error"}
    assert "secret database password" not in response.text
    assert "Traceback" not in response.text


def test_rows_survive_a_new_database_session(tmp_path: Path) -> None:
    url = "sqlite:///" + (tmp_path / "todo.db").as_posix()
    engine = create_db_engine(url)
    Base.metadata.create_all(engine)
    first = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)()
    try:
        TodoService(first).create_todo(TodoCreate(title="persist me", description=None))
    finally:
        first.close()
    engine.dispose()

    reopened = create_db_engine(url)
    second = sessionmaker(bind=reopened, autoflush=False, expire_on_commit=False)()
    try:
        items, total = TodoService(second).list_todos(
            done=None,
            limit=None,
            offset=0,
            sort="created_at",
            order="desc",
        )
        assert total == 1
        assert items[0].title == "persist me"
    finally:
        second.close()
        reopened.dispose()
